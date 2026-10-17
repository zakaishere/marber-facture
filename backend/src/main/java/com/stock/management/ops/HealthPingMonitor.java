package com.stock.management.ops;

import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.web.context.WebServerApplicationContext;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Optional self-contained monitor. Removing this class leaves /health unchanged. */
@Component
@ConditionalOnProperty(prefix="app.health-ping",name="enabled",havingValue="true",matchIfMissing=true)
public class HealthPingMonitor {
    private static final Logger log=LoggerFactory.getLogger(HealthPingMonitor.class);
    private final String configuredUrl;
    private final long intervalSeconds;
    private final long timeoutSeconds;
    private final HttpClient client;
    private ScheduledExecutorService scheduler;

    public HealthPingMonitor(@Value("${app.health-ping.url:}") String url,
            @Value("${app.health-ping.interval-seconds:300}") long intervalSeconds,
            @Value("${app.health-ping.timeout-seconds:60}") long timeoutSeconds){
        this.configuredUrl=url.trim();
        this.intervalSeconds=intervalSeconds;
        this.timeoutSeconds=timeoutSeconds;
        client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ready(ApplicationReadyEvent event){
        if(event.getApplicationContext() instanceof WebServerApplicationContext context)
            startMonitoring(context.getWebServer().getPort());
    }

    synchronized void startMonitoring(int port){
        if(scheduler!=null)return;
        URI target;
        try{
            target=URI.create(configuredUrl.isBlank()?"http://127.0.0.1:"+port+"/health":configuredUrl);
            if(!java.util.Set.of("http","https").contains(target.getScheme())||target.getHost()==null||target.getUserInfo()!=null
                    ||intervalSeconds<1||timeoutSeconds<1)throw new IllegalArgumentException();
        }catch(Exception ex){
            log.warn("Automatic health ping disabled: check APP_HEALTH_PING_URL and positive interval/timeout settings.");
            return;
        }
        scheduler=Executors.newSingleThreadScheduledExecutor(task->{
            Thread thread=new Thread(task,"health-ping-monitor");thread.setDaemon(true);return thread;
        });
        scheduler.scheduleAtFixedRate(()->check(target),0,intervalSeconds,TimeUnit.SECONDS);
        log.info("Automatic health ping enabled: every {} seconds. Disable with APP_HEALTH_PING_ENABLED=false.",intervalSeconds);
    }

    private void check(URI target){
        long started=System.nanoTime();
        try{
            var request=HttpRequest.newBuilder(target).timeout(Duration.ofSeconds(timeoutSeconds))
                .header("User-Agent","MarberFacture-HealthMonitor/1.0").GET().build();
            int status=client.send(request,HttpResponse.BodyHandlers.discarding()).statusCode();
            long elapsed=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-started);
            if(status>=200&&status<300)log.info("Health ping UP: HTTP {} ({} ms)",status,elapsed);
            else log.warn("Health ping DOWN: HTTP {} ({} ms). Will retry.",status,elapsed);
        }catch(InterruptedException ex){Thread.currentThread().interrupt();}
        catch(Exception ex){
            // Do not log the URL, response body, or exception text: these may include secrets.
            log.warn("Health ping DOWN: request failed or timed out. Will retry.");
        }
    }

    @PreDestroy
    public synchronized void stop(){
        if(scheduler!=null)scheduler.shutdownNow();
        client.shutdownNow();
    }
}
