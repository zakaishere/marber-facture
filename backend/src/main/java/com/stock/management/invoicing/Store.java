package com.stock.management.invoicing;

import com.stock.management.common.error.ResourceNotFoundException;
import com.stock.management.common.id.IdGenerator;
import java.sql.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

/** SQL identifiers are supplied only by application code, never by request parameters. */
@Component
public class Store {
    public final JdbcTemplate jdbc;
    private final IdGenerator ids;
    public Store(JdbcTemplate jdbc, IdGenerator ids) { this.jdbc=jdbc; this.ids=ids; }
    public String id() { return ids.next(); }
    public static final RowMapper<Map<String,Object>> ROW = (rs,n) -> {
        Map<String,Object> row=new LinkedHashMap<>();
        for(int i=1;i<=rs.getMetaData().getColumnCount();i++) {
            String key=rs.getMetaData().getColumnLabel(i).toLowerCase(Locale.ROOT);
            StringBuilder camel=new StringBuilder(); boolean upper=false;
            for(char c:key.toCharArray()) { if(c=='_') upper=true; else {camel.append(upper?Character.toUpperCase(c):c); upper=false;} }
            Object value=rs.getObject(i);
            if(value instanceof Timestamp ts) value=ts.toLocalDateTime().toString();
            else if(value instanceof java.sql.Date dt) value=dt.toString();
            row.put(camel.toString(),value);
        }
        return row;
    };
    public List<Map<String,Object>> query(String sql,Object... args) { return jdbc.query(sql,ROW,args); }
    public Map<String,Object> get(String table,String id) {
        return query("SELECT * FROM "+table+" WHERE id=?",id).stream().findFirst()
            .orElseThrow(()->new ResourceNotFoundException("Élément introuvable"));
    }
    public Map<String,Object> lock(String table,String id) {
        return query("SELECT * FROM "+table+" WHERE id=? FOR UPDATE",id).stream().findFirst()
            .orElseThrow(()->new ResourceNotFoundException("Document introuvable"));
    }
    public String insert(String table,Map<String,Object> data) {
        Map<String,Object> values=new LinkedHashMap<>(data); values.putIfAbsent("id",id());
        String columns=String.join(",",values.keySet());
        String placeholders=String.join(",",Collections.nCopies(values.size(),"?"));
        jdbc.update("INSERT INTO "+table+" ("+columns+") VALUES ("+placeholders+")",values.values().toArray());
        return values.get("id").toString();
    }
    public void update(String table,String id,Map<String,Object> data) {
        if(data.isEmpty()) return;
        List<Object> args=new ArrayList<>(data.values()); args.add(id);
        String set=String.join(",",data.keySet().stream().map(k->k+"=?").toList());
        jdbc.update("UPDATE "+table+" SET "+set+", updated_at=CURRENT_TIMESTAMP WHERE id=?",args.toArray());
    }
}
