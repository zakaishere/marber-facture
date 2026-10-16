package com.stock.management.invoicing;

import com.stock.management.common.error.BadRequestException;
import java.math.*;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Length/width retain the entered unit. All billing surfaces are square metres. */
@Component
public class LineCalculator {
    public record Amounts(BigDecimal length,BigDecimal width,String unit,int pieces,BigDecimal surface,BigDecimal totalSurface,BigDecimal price,BigDecimal rate,BigDecimal ht,BigDecimal tva,BigDecimal ttc) {}
    public static BigDecimal money(BigDecimal n){return n.setScale(2,RoundingMode.HALF_UP);}
    public Amounts calculate(Map<String,Object> line,boolean purchase){
        BigDecimal length=positive(line.get("length"),"Longueur",3);
        BigDecimal width=positive(line.get("width"),"Largeur",3);
        String unit=Input.choice(line.get("dimensionUnit"),"M","M","CM");
        int pieces;
        try{pieces=Input.decimal(line.getOrDefault("quantity",1),"PCS").intValueExact();}
        catch(ArithmeticException ex){throw new BadRequestException("PCS doit être un nombre entier");}
        if(pieces<1||pieces>100000)throw new BadRequestException("PCS doit être compris entre 1 et 100000");
        BigDecimal price=Input.nonnegative(line.get(purchase?"unitPrice":"unitPriceTtc"),"Prix TTC/m²");
        if(price.scale()>2)throw new BadRequestException("Prix TTC/m² : au plus deux décimales");
        if(price.compareTo(new BigDecimal("9999999999.99"))>0)throw new BadRequestException("Prix TTC/m² : maximum 9 999 999 999,99 MAD");
        BigDecimal rate=new BigDecimal("0.20");
        if(line.get("tvaPercent")!=null&&Input.decimal(line.get("tvaPercent"),"TVA").compareTo(new BigDecimal("20"))!=0)
            throw new BadRequestException("La TVA est fixée à 20 %");
        BigDecimal surface=length.multiply(width);
        if(unit.equals("CM"))surface=surface.movePointLeft(4);
        surface=surface.setScale(6,RoundingMode.HALF_UP);
        if(surface.signum()==0)throw new BadRequestException("Surface trop petite: augmentez la précision des dimensions");
        BigDecimal totalSurface=surface.multiply(BigDecimal.valueOf(pieces));
        BigDecimal ttc=money(totalSurface.multiply(price));
        if(ttc.compareTo(new BigDecimal("999999999999.99"))>0)throw new BadRequestException("Montant de ligne : maximum 999 999 999 999,99 MAD TTC");
        BigDecimal ht=ttc.divide(BigDecimal.ONE.add(rate),2,RoundingMode.HALF_UP);
        return new Amounts(length,width,unit,pieces,surface,totalSurface,price,rate,ht,ttc.subtract(ht),ttc);
    }
    private BigDecimal positive(Object value,String field,int scale){
        BigDecimal n=Input.nonnegative(value,field);
        if(n.signum()==0||n.scale()>scale||n.compareTo(new BigDecimal("100000"))>0)throw new BadRequestException(field+": > 0, au plus "+scale+" décimales et maximum 100000");
        return n;
    }
}
