package com.stock.management.ops;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import static org.assertj.core.api.Assertions.*;

class HealthPingMonitorTest {
    @Test void automaticallyRepeatsAndRecoversAfterAnUnhealthyResponse() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        AtomicInteger requests=new AtomicInteger();
        CountDownLatch received=new CountDownLatch(3);
        server.createContext("/external-health",exchange->{
            int count=requests.incrementAndGet();
            exchange.sendResponseHeaders(count==1?503:200,-1);exchange.close();received.countDown();
        });
        server.start();
        var monitor=new HealthPingMonitor("http://127.0.0.1:"+server.getAddress().getPort()+"/external-health",1,2);
        try{
            monitor.startMonitoring(9999);
            assertThat(received.await(6,TimeUnit.SECONDS)).isTrue();
            assertThat(requests.get()).isGreaterThanOrEqualTo(3);
        }finally{monitor.stop();server.stop(0);}
    }
    @Test void noConfiguredUrlUsesTheActualBackendPortAndShutdownStopsRequests() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        CountDownLatch received=new CountDownLatch(1);
        AtomicInteger requests=new AtomicInteger();
        server.createContext("/health",exchange->{requests.incrementAndGet();exchange.sendResponseHeaders(200,-1);exchange.close();received.countDown();});
        server.start();
        var monitor=new HealthPingMonitor("",1,2);
        try{
            monitor.startMonitoring(server.getAddress().getPort());
            assertThat(received.await(3,TimeUnit.SECONDS)).isTrue();
            monitor.stop();int before=requests.get();
            Thread.sleep(1200);
            assertThat(requests.get()).isEqualTo(before);
        }finally{monitor.stop();server.stop(0);}
    }
    @Test void automaticMonitorCanBeDisabledWithoutRemovingTheHealthController(){
        new ApplicationContextRunner().withUserConfiguration(HealthPingMonitor.class)
            .withPropertyValues("app.health-ping.enabled=false")
            .run(context->assertThat(context).doesNotHaveBean(HealthPingMonitor.class));
    }
}
