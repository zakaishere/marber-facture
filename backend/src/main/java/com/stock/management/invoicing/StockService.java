package com.stock.management.invoicing;

import com.stock.management.common.error.BadRequestException;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Product locks serialize concurrent document changes; document lines remain the stock ledger. */
@Service
public class StockService {
    private final Store db;private final boolean enforce;
    public StockService(Store db,@Value("${app.stock.enforce-availability:false}") boolean enforce){this.db=db;this.enforce=enforce;}
    public Map<String,BigDecimal> lock(Collection<String> ids){
        var before=new LinkedHashMap<String,BigDecimal>();
        for(String id:new TreeSet<>(ids)){
            db.lock("products",id);
            before.put(id,balance(id));
        }
        return before;
    }
    private BigDecimal balance(String id){return db.jdbc.queryForObject("SELECT quantity FROM product_stock WHERE product_id=?",BigDecimal.class,id);}
    public void validate(Map<String,BigDecimal> before){
        if(!enforce)return;
        for(var entry:before.entrySet()){
            BigDecimal after=balance(entry.getKey());
            // Existing incomplete purchase histories may already be negative. Permit corrections, never worsen them.
            if(after.signum()<0&&after.compareTo(entry.getValue())<0){
                var product=db.get("products",entry.getKey());
                throw new BadRequestException("Stock insuffisant pour "+product.get("name")+". Disponible avant modification : "+entry.getValue().stripTrailingZeros().toPlainString()+" m². Enregistrez le bon d'achat correspondant.");
            }
        }
    }
}
