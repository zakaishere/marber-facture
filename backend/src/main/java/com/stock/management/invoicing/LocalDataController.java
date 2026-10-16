package com.stock.management.invoicing;
import java.security.Principal;
import java.util.Map;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/auth/local-data")
public class LocalDataController {
    private final LocalDataService service;
    public LocalDataController(LocalDataService service){this.service=service;}
    @PostMapping("/backup") public ResponseEntity<Resource> backup(){var file=service.backup();return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/zip")).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(file.getFileName().toString()).build().toString()).body(new FileSystemResource(file));}
    @PostMapping("/import") public Map<String,Object> importPreview(@RequestBody Map<String,Object> body,Principal principal){return service.importPreview(body,principal.getName());}
}
