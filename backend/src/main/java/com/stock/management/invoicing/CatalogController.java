package com.stock.management.invoicing;

import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

@RestController
public class CatalogController {
    private final CatalogService service;
    public CatalogController(CatalogService service){this.service=service;}
    @GetMapping("/products/summary") public Map<String,Object> summary(){return service.summary();}
    @GetMapping("/{resource:clients|suppliers|products|categories}") public List<Map<String,Object>> list(@PathVariable String resource,@RequestParam Map<String,String> q){return service.list(resource,q);}
    @GetMapping("/{resource:clients|suppliers|products|categories}/{id}") public Map<String,Object> get(@PathVariable String resource,@PathVariable String id){return service.get(resource,id);}
    @PostMapping("/{resource:clients|suppliers|products|categories}") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> create(@PathVariable String resource,@RequestBody Map<String,Object> body){return service.save(resource,null,body);}
    @PutMapping("/{resource:clients|suppliers|products|categories}/{id}") public Map<String,Object> update(@PathVariable String resource,@PathVariable String id,@RequestBody Map<String,Object> body){return service.save(resource,id,body);}
    @DeleteMapping("/{resource:clients|suppliers|products|categories}/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String resource,@PathVariable String id){service.delete(resource,id);}
}
