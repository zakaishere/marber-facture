package com.stock.management.invoicing;

import com.stock.management.common.error.BadRequestException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

public final class Input {
    private Input() {}
    public static String text(Object v) { return v==null?"":v.toString().trim(); }
    public static String required(Map<String,Object> b,String field,int max) {
        String v=text(b.get(field));
        if(v.isEmpty()||v.length()>max) throw new BadRequestException(field+" est requis (maximum "+max+" caractères)");
        return v;
    }
    public static String optional(Object v,int max) {
        String s=text(v); if(s.length()>max) throw new BadRequestException("Texte trop long (maximum "+max+")");
        return s.isEmpty()?null:s;
    }
    public static BigDecimal decimal(Object v,String name) {
        try { return new BigDecimal(text(v)); } catch(Exception ex) { throw new BadRequestException(name+" doit être un nombre valide"); }
    }
    public static BigDecimal nonnegative(Object v,String name) {
        BigDecimal n=decimal(v,name); if(n.signum()<0) throw new BadRequestException(name+" doit être positif"); return n;
    }
    public static String choice(Object v,String fallback,String... allowed) {
        String s=text(v); if(s.isEmpty()) return fallback;
        if(!Arrays.asList(allowed).contains(s)) throw new BadRequestException("Valeur invalide: "+s); return s;
    }
    public static LocalDate date(Object v) {
        if(text(v).isEmpty()) return LocalDate.now();
        try {return LocalDate.parse(text(v));} catch(Exception ex) {throw new BadRequestException("Date invalide: format AAAA-MM-JJ attendu");}
    }
    public static int page(Map<String,String> q) {return bounded(q.getOrDefault("page","1"),1,1000000);}
    public static int limit(Map<String,String> q) {return bounded(q.getOrDefault("pageSize",q.getOrDefault("limit","50")),1,10000);}
    public static int bounded(String v,int min,int max) {
        try {int n=Integer.parseInt(v); if(n<min||n>max) throw new Exception(); return n;}
        catch(Exception ex){throw new BadRequestException("Pagination invalide");}
    }
}
