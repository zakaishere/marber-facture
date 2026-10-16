package com.stock.management.invoicing;

import java.security.Principal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class DocumentController {
    private final DocumentService service;
    public DocumentController(DocumentService service){this.service=service;}
    @GetMapping("/invoice-options") public Map<String,Object> invoiceOptions(){return service.invoiceOptions();}
    private boolean purchase(String resource){return resource.equals("bon-achat");}
    @GetMapping("/{resource:factures|bon-achat}") public Object list(@PathVariable String resource,@RequestParam Map<String,String> q){return "true".equals(q.get("paged"))?service.page(purchase(resource),q):service.list(purchase(resource),q);}
    @GetMapping("/{resource:factures|bon-achat}/{id}") public Map<String,Object> get(@PathVariable String resource,@PathVariable String id){return service.get(purchase(resource),id);}
    @GetMapping("/{resource:factures|bon-achat}/by-code/{code}") public Map<String,Object> code(@PathVariable String resource,@PathVariable String code){return service.byCode(purchase(resource),code);}
    @PostMapping("/{resource:factures|bon-achat}") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> create(@PathVariable String resource,@RequestBody Map<String,Object> b,Principal p){return service.save(purchase(resource),null,b,p.getName());}
    @PutMapping("/{resource:factures|bon-achat}/{id}") public Map<String,Object> update(@PathVariable String resource,@PathVariable String id,@RequestBody Map<String,Object> b,Principal p){return service.save(purchase(resource),id,b,p.getName());}
    @DeleteMapping("/{resource:factures|bon-achat}/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String resource,@PathVariable String id){service.delete(purchase(resource),id);}
    @GetMapping("/{resource:factures|bon-achat}/{id}/payments") public List<Map<String,Object>> payments(@PathVariable String resource,@PathVariable String id){return service.payments(purchase(resource),id);}
    @PostMapping("/{resource:factures|bon-achat}/{id}/payments") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> addPayment(@PathVariable String resource,@PathVariable String id,@RequestBody Map<String,Object> b){return service.payment(purchase(resource),id,null,b,false);}
    @PutMapping("/{resource:factures|bon-achat}/{id}/payments/{paymentId}") public Map<String,Object> editPayment(@PathVariable String resource,@PathVariable String id,@PathVariable String paymentId,@RequestBody Map<String,Object> b){return service.payment(purchase(resource),id,paymentId,b,false);}
    @DeleteMapping("/{resource:factures|bon-achat}/{id}/payments/{paymentId}") public Map<String,Object> removePayment(@PathVariable String resource,@PathVariable String id,@PathVariable String paymentId){return service.payment(purchase(resource),id,paymentId,Map.of(),true);}
    @PatchMapping("/bon-achat/{id}/payment") public Object legacyPayment(@PathVariable String id,@RequestBody Map<String,Object> b){Map<String,Object> payload=new HashMap<>(b);payload.put("method",b.getOrDefault("paymentMethod","CASH"));return service.payment(true,id,null,payload,false).get("bon");}
    @PatchMapping("/factures/{id}/notes") public Map<String,Object> notes(@PathVariable String id,@RequestBody Map<String,Object> body){return service.saveNotes(id,body);}
    @GetMapping("/dashboard") public Map<String,Object> dashboard(){return service.dashboard();}
    @GetMapping("/clients/{id}/documents") public Object clientHistory(@PathVariable String id,@RequestParam Map<String,String> q){return "true".equals(q.get("paged"))?service.history(false,id,q):service.list(false,Map.of("clientId",id,"limit","10000"));}
    @GetMapping("/suppliers/{id}/documents") public Object supplierHistory(@PathVariable String id,@RequestParam Map<String,String> q){return "true".equals(q.get("paged"))?service.history(true,id,q):service.list(true,Map.of("supplierId",id,"limit","10000"));}
}
