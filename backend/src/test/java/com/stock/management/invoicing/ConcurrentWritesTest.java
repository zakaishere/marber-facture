package com.stock.management.invoicing;

import com.stock.management.common.error.BadRequestException;
import com.stock.management.user.UserRepository;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import static org.assertj.core.api.Assertions.*;

/** Real overlapping transactions on an isolated database, never the running application. */
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:marble_concurrency;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1","app.stock.enforce-availability=true"})
@ActiveProfiles("test")
class ConcurrentWritesTest {
    @Autowired DocumentService documents;@Autowired CatalogService catalog;@Autowired UserRepository users;
    private Map<String,Object> body(){
        String category=catalog.save("categories",null,Map.of("name","Concurrent "+UUID.randomUUID())).get("id").toString();
        String product=catalog.save("products",null,Map.of("name","Marble","categoryId",category,"salePrice",100)).get("id").toString();
        String client=catalog.save("clients",null,Map.of("name","Concurrent client")).get("id").toString();
        String supplier=catalog.save("suppliers",null,Map.of("name","Concurrent supplier")).get("id").toString();
        documents.save(true,null,Map.of("supplierId",supplier,"items",List.of(Map.of("productId",product,"length",100,"width",100,"quantity",20,"dimensionUnit","CM","unitPrice",100))),users.findByUsername("admin").orElseThrow().getId());
        return Map.of("clientId",client,"date","2097-04-10","items",List.of(Map.of("productId",product,"length",100,"width",100,"quantity",1,"dimensionUnit","CM","unitPriceTtc",100)));
    }
    @Test void simultaneousCreatesHaveUniqueNumbersAndCompleteLines()throws Exception{
        var body=body();String user=users.findByUsername("admin").orElseThrow().getId();
        ExecutorService executor=Executors.newFixedThreadPool(4);
        try{
            var tasks=new ArrayList<Future<Map<String,Object>>>();for(int i=0;i<12;i++)tasks.add(executor.submit(()->documents.save(false,null,body,user)));
            var codes=new HashSet<String>();for(var task:tasks){var saved=task.get(30,TimeUnit.SECONDS);codes.add(saved.get("code").toString());assertThat((List<?>)saved.get("items")).hasSize(1);}
            assertThat(codes).hasSize(12);
        }finally{executor.shutdownNow();}
    }
    @Test void simultaneousPreviewsDoNotReserveAndCreatesUseTheFinalMonthlySequence()throws Exception{
        var body=new HashMap<>(body());body.put("date","2182-05-10");
        String user=users.findByUsername("admin").orElseThrow().getId();
        var executor=Executors.newFixedThreadPool(4);var ready=new CountDownLatch(4);var start=new CountDownLatch(1);
        var previews=new ConcurrentLinkedQueue<String>();
        try{
            var tasks=new ArrayList<Future<Map<String,Object>>>();
            for(int i=0;i<12;i++)tasks.add(executor.submit(()->{
                previews.add(documents.invoiceNumberPreview("2182-05-10",null).get("code").toString());ready.countDown();
                if(!start.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Start timeout");
                return documents.save(false,null,body,user);
            }));
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();
            assertThat(previews).containsOnly("01-05-2182");start.countDown();
            var codes=new HashSet<String>();for(var task:tasks){var invoice=task.get(30,TimeUnit.SECONDS);codes.add(invoice.get("code").toString());assertThat((List<?>)invoice.get("items")).hasSize(1);}
            var expected=new HashSet<String>();for(int i=1;i<=12;i++)expected.add(String.format("%02d-05-2182",i));
            assertThat(codes).isEqualTo(expected);
            assertThat(documents.invoiceNumberPreview("2182-05-20",null).get("code")).isEqualTo("13-05-2182");
        }finally{start.countDown();executor.shutdownNow();}
    }
    @Test void concurrentMonthChangesAssignDifferentNumbersAndKeepTheOldCounter()throws Exception{
        var body=new HashMap<>(body());body.put("date","2183-04-01");
        String user=users.findByUsername("admin").orElseThrow().getId();
        String first=documents.save(false,null,body,user).get("id").toString();
        String second=documents.save(false,null,body,user).get("id").toString();
        var executor=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try{
            var a=executor.submit(()->{gate.await();return documents.save(false,first,Map.of("date","2183-06-01"),user);});
            var b=executor.submit(()->{gate.await();return documents.save(false,second,Map.of("date","2183-06-20"),user);});
            gate.countDown();
            assertThat(List.of(a.get(30,TimeUnit.SECONDS).get("code"),b.get(30,TimeUnit.SECONDS).get("code")))
                .containsExactlyInAnyOrder("01-06-2183","02-06-2183");
            assertThat(documents.invoiceNumberPreview("2183-04-10",null).get("code")).isEqualTo("03-04-2183");
        }finally{gate.countDown();executor.shutdownNow();}
    }
    @Test void simultaneousPaymentsCannotOverpay()throws Exception{
        String user=users.findByUsername("admin").orElseThrow().getId();String id=documents.save(false,null,body(),user).get("id").toString();
        ExecutorService executor=Executors.newFixedThreadPool(2);
        try{
            Callable<Boolean> pay=()->{try{documents.payment(false,id,null,Map.of("amount",60,"method","ESPECE"),false);return true;}catch(BadRequestException rejected){return false;}};
            var first=executor.submit(pay);var second=executor.submit(pay);
            assertThat(List.of(first.get(30,TimeUnit.SECONDS),second.get(30,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
            assertThat(documents.get(false,id).get("paidAmount").toString()).isEqualTo("60.00");
        }finally{executor.shutdownNow();}
    }
    @Test void simultaneousSalesCannotOversell()throws Exception{
        var payload=new HashMap<>(body());var line=new HashMap<>((Map<String,Object>)((List<?>)payload.get("items")).getFirst());line.put("quantity",15);payload.put("items",List.of(line));
        String user=users.findByUsername("admin").orElseThrow().getId();var executor=Executors.newFixedThreadPool(2);
        try{
            Callable<Boolean> sell=()->{try{documents.save(false,null,payload,user);return true;}catch(BadRequestException rejected){return false;}};
            var first=executor.submit(sell);var second=executor.submit(sell);
            assertThat(List.of(first.get(30,TimeUnit.SECONDS),second.get(30,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
            assertThat(catalog.get("products",line.get("productId").toString()).get("quantity").toString()).startsWith("5");
        }finally{executor.shutdownNow();}
    }
}
