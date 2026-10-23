package com.stock.management.invoicing;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stock.management.auth.dto.UserResponse;
import com.stock.management.common.error.*;
import com.stock.management.user.UserRepository;
import java.math.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

@Service
public class DocumentService {
    private final Store db;
    private final LineCalculator calculator;
    private final ObjectMapper json;
    private final UserRepository users;
    private final StockService stock;private final CatalogService catalog;
    public DocumentService(Store db,LineCalculator calculator,ObjectMapper json,UserRepository users,StockService stock,CatalogService catalog){this.db=db;this.calculator=calculator;this.json=json;this.users=users;this.stock=stock;this.catalog=catalog;}
    private String table(boolean purchase){return purchase?"bon_achats":"factures";}
    private String lines(boolean purchase){return purchase?"bon_achat_lines":"facture_lines";}
    private String fk(boolean purchase){return purchase?"bon_achat_id":"facture_id";}
    private String party(boolean purchase){return purchase?"supplier":"client";}
    private String totalKey(boolean purchase){return purchase?"totalAmount":"totalTtc";}
    private String totalColumn(boolean purchase){return purchase?"total_amount":"total_ttc";}
    private BigDecimal number(Object v){return Input.decimal(v,"Montant");}
    private String encode(Object o){try{return json.writeValueAsString(o);}catch(Exception e){throw new IllegalStateException("Cannot store document snapshot",e);}}
    private String restrictedUser(){
        var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return auth!=null&&auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_INVOICING"))?auth.getName():null;
    }
    private void checkInvoiceAccess(boolean purchase){
        if(restrictedUser()!=null&&purchase)throw new ResourceNotFoundException("Document introuvable");
    }
    @Transactional(readOnly=true)
    public Map<String,Object> invoiceOptions(){return Map.of("clients",db.query("SELECT id,name,address,ice FROM clients ORDER BY name"),"products",db.query("SELECT p.id,p.name,p.code,p.sale_price,s.quantity FROM products p JOIN product_stock s ON s.product_id=p.id ORDER BY p.name"));}
    private Map<String,Object> decode(Object o){try{return json.readValue(o.toString(),new TypeReference<>(){});}catch(Exception e){throw new IllegalStateException("Cannot read document snapshot",e);}}

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> get(boolean purchase,String id){return detail(purchase,db.get(table(purchase),id));}
    @Transactional
    public Map<String,Object> saveNotes(String id,Map<String,Object> body){
        if(!body.containsKey("notes"))throw new BadRequestException("Le champ notes est requis");
        String notes=Input.optional(body.get("notes"),4000);
        db.lock("factures",id);
        var update=new LinkedHashMap<String,Object>();update.put("notes",notes);db.update("factures",id,update);
        var saved=db.get("factures",id);var result=new LinkedHashMap<String,Object>();
        result.put("id",id);result.put("notes",saved.get("notes"));result.put("updatedAt",saved.get("updatedAt"));return result;
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> byCode(boolean purchase,String code){
        var rows=db.query("SELECT * FROM "+table(purchase)+" WHERE code=?",code);
        if(rows.isEmpty())throw new ResourceNotFoundException("Document introuvable"); return detail(purchase,rows.getFirst());
    }
    private Map<String,Object> detail(boolean purchase,Map<String,Object> header){
        checkInvoiceAccess(purchase);
        if(restrictedUser()!=null)header.remove("notes");
        String id=header.get("id").toString();
        header.put(party(purchase),decode(header.remove(party(purchase)+"Snapshot")));
        header.put("company",decode(header.remove("companySnapshot")));
        if(!purchase){
            var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            String creatorId=Input.text(header.get("createdBy"));
            if(creatorId.isBlank()&&auth!=null)creatorId=auth.getName();
            var creator=users.findById(creatorId);
            var issuer=creator.flatMap(u->u.getOwnerAdminId()==null?Optional.of(u):users.findById(u.getOwnerAdminId()));
            header.put("printCompany",issuer.<Object>map(u->UserResponse.from(u).company()).orElse(header.get("company")));
        }
        var items=db.query("SELECT * FROM "+lines(purchase)+" WHERE "+fk(purchase)+"=? ORDER BY position",id);
        for(var line:items){
            line.put("product",Map.of("id",line.get("productId"),"name",line.remove("productName"),"code",line.remove("productCode")));
            line.put("totalSurface",number(line.get("surface")).multiply(number(line.get("quantity"))));
        }
        header.put("items",items);
        BigDecimal paid=header.containsKey("paidAmount")?number(header.get("paidAmount")):paid(purchase,id);
        BigDecimal remaining=number(header.get(totalKey(purchase))).subtract(paid);
        header.put("paidAmount",paid);header.put("remainingAmount",remaining);
        header.put("paymentStatus",paid.signum()==0?"UNPAID":remaining.signum()==0?"PAID":"PARTIAL");
        if(purchase&&!"CANCELLED".equals(header.get("status")))header.put("status",remaining.signum()==0?"COMPLETED":"PENDING");
        return header;
    }
    private record Selection(String from,List<Object> args) {}
    private String paidSql(boolean purchase){return "(SELECT COALESCE(SUM(amount),0) FROM payments pay WHERE pay."+fk(purchase)+"=d.id)";}
    private Selection selection(boolean purchase,Map<String,String> q){
        String p=party(purchase);List<Object> args=new ArrayList<>();
        String sql=" FROM "+table(purchase)+" d JOIN "+p+"s p ON p.id=d."+p+"_id WHERE 1=1";
        if(!Input.text(q.get("search")).isEmpty()){sql+=" AND (LOWER(d.code) LIKE ? OR LOWER(p.name) LIKE ?)";String search="%"+q.get("search").toLowerCase(Locale.ROOT)+"%";args.add(search);args.add(search);}
        for(String f:List.of("dateFrom","dateTo"))if(!Input.text(q.get(f)).isEmpty()){sql+=" AND d.date"+(f.equals("dateFrom")?">=":"<=")+"?";args.add(Input.date(q.get(f)));}
        if(!Input.text(q.get(p+"Id")).isEmpty()){sql+=" AND d."+p+"_id=?";args.add(q.get(p+"Id"));}
        if(!Input.text(q.get("status")).isEmpty()){
            if(purchase){
                String status=Input.choice(q.get("status"),"PENDING","PENDING","COMPLETED","CANCELLED");
                if(status.equals("CANCELLED"))sql+=" AND d.status='CANCELLED'";
                else {sql+=" AND d.status<>'CANCELLED' AND d.total_amount "+(status.equals("COMPLETED")?"<=":">")+" (SELECT COALESCE(SUM(amount),0) FROM payments pay WHERE pay.bon_achat_id=d.id)";}
            }else{sql+=" AND d.status=?";args.add(q.get("status"));}
        }
        if(!Input.text(q.get("paymentMethod")).isEmpty()){
            String[] methods=q.get("paymentMethod").split(",");sql+=" AND d.payment_method IN ("+String.join(",",Collections.nCopies(methods.length,"?"))+")";args.addAll(Arrays.asList(methods));
        }
        for(String f:List.of("minTtc","maxTtc","minHt","maxHt","minAmount","maxAmount"))if(!Input.text(q.get(f)).isEmpty()){
            sql+=" AND d."+(f.endsWith("Ht")?"total_ht":totalColumn(purchase))+(f.startsWith("min")?">=":"<=")+"?";args.add(Input.nonnegative(q.get(f),f));
        }
        return new Selection(sql,args);
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public List<Map<String,Object>> list(boolean purchase,Map<String,String> q){
        var selection=selection(purchase,q);var args=new ArrayList<>(selection.args());
        String sort=switch(q.getOrDefault("sortBy","date")){
            case "code"->"d.code";case "totalHt"->"d.total_ht";case "totalTva"->"d.total_tva";case "totalAmount","totalTtc"->"d."+totalColumn(purchase);
            case "client","supplier"->"p.name";case "paymentMethod"->"d.payment_method";case "status"->"d.status";default->"d.date";};
        // Lists omit document lines; a whole page needs one database round trip.
        String sql="SELECT d.*, "+paidSql(purchase)+" AS paid_amount"+selection.from()+" ORDER BY "+sort+("ASC".equalsIgnoreCase(q.get("sortOrder"))?" ASC":" DESC")+", d.id LIMIT ? OFFSET ?";
        args.add(Input.limit(q));args.add((long)(Input.page(q)-1)*Input.limit(q));
        return db.query(sql,args.toArray()).stream().map(row->{
            if(restrictedUser()!=null)row.remove("notes");
            if("true".equals(q.get("includeItems")))return detail(purchase,row);
            row.put(party(purchase),decode(row.remove(party(purchase)+"Snapshot")));row.remove("companySnapshot");
            BigDecimal paid=number(row.get("paidAmount")),remaining=number(row.get(totalKey(purchase))).subtract(paid);
            row.put("remainingAmount",remaining);row.put("paymentStatus",paid.signum()==0?"UNPAID":remaining.signum()==0?"PAID":"PARTIAL");
            if(purchase&&!"CANCELLED".equals(row.get("status")))row.put("status",remaining.signum()==0?"COMPLETED":"PENDING");
            return row;
        }).toList();
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> page(boolean purchase,Map<String,String> q){
        var selection=selection(purchase,q);
        long total=db.jdbc.queryForObject("SELECT COUNT(*)"+selection.from(),Long.class,selection.args().toArray());
        return Map.of("data",list(purchase,q),"total",total,"page",Input.page(q),"pageSize",Input.limit(q));
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> history(boolean purchase,String id,Map<String,String> q){
        db.get(party(purchase)+"s",id);var filters=new HashMap<>(q);filters.put(party(purchase)+"Id",id);
        var result=new LinkedHashMap<>(page(purchase,filters));var selection=selection(purchase,filters);
        String active=purchase?" AND d.status<>'CANCELLED'":"";
        var totals=db.query("SELECT COALESCE(SUM(d."+totalColumn(purchase)+"),0) AS total_amount, COALESCE(SUM("+paidSql(purchase)+"),0) AS paid_amount"+selection.from()+active,selection.args().toArray()).getFirst();
        totals.put("remainingAmount",number(totals.get("totalAmount")).subtract(number(totals.get("paidAmount"))));result.put("summary",totals);return result;
    }
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String,Object> save(boolean purchase,String id,Map<String,Object> body,String userId){
        var creator=users.findById(userId).orElseThrow(()->new BadRequestException("Utilisateur invalide"));
        boolean restricted=creator.getRole()==com.stock.management.user.Role.ROLE_INVOICING;
        if(restricted&&(purchase||id!=null))throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN,"Création et impression de factures uniquement");
        if(restricted){body=new LinkedHashMap<>(body);body.put("notes",null);body.put("paymentMethod",null);body.put("status","NOT_DECLARED");}
        String table=table(purchase),p=party(purchase);
        Map<String,Object> old=id==null?new LinkedHashMap<>():db.lock(table,id);
        if(purchase&&"CANCELLED".equals(old.get("status")))throw new BadRequestException("Ce bon est annulé");
        Map<String,Object> merged=new LinkedHashMap<>(old);merged.putAll(body);
        String partyId=Input.required(merged,p+"Id",25);Map<String,Object> contact=db.get(p+"s",partyId);
        LocalDate date=Input.date(merged.get("date"));
        String code=Input.text(merged.get("code"));
        if(purchase){
            if(id==null&&code.isEmpty()||id!=null&&!body.containsKey("code")&&!date.toString().equals(old.get("date")))code=nextCode(true,date);
            if(code.isEmpty()||code.length()>50)throw new BadRequestException("Numéro de document invalide");
        }
        String method=method(purchase,merged.get("paymentMethod"));
        String status=purchase?Input.choice(merged.get("status"),"PENDING","PENDING","COMPLETED","CANCELLED"):Input.choice(merged.get("status"),"NOT_DECLARED","DECLARED","NOT_DECLARED");
        Object raw=body.containsKey("items")?body.get("items"):body.get("lines");
        if(raw==null&&id!=null)raw=get(purchase,id).get("items");
        if(!(raw instanceof List<?> requested)||requested.isEmpty()||requested.size()>1000)throw new BadRequestException("Ajoutez de 1 à 1000 lignes");
        var records=new ArrayList<Map<String,Object>>();BigDecimal ht=BigDecimal.ZERO,tva=BigDecimal.ZERO,ttc=BigDecimal.ZERO;int position=0;
        Map<String,Map<String,Object>> prior=new HashMap<>();
        if(id!=null)for(var line:db.query("SELECT * FROM "+lines(purchase)+" WHERE "+fk(purchase)+"=?",id))prior.put(line.get("id").toString(),line);
        Map<String,Map<String,Object>> products=new HashMap<>();
        for(Object value:requested){
            if(!(value instanceof Map<?,?>))throw new BadRequestException("Ligne invalide");Map<String,Object> line=(Map<String,Object>)value;
            String productId=Input.required(line,"productId",25);var product=products.computeIfAbsent(productId,key->db.get("products",key));
            var amount=calculator.calculate(line,purchase);
            Map<String,Object> record=new LinkedHashMap<>();record.put("product_id",productId);
            var before=prior.get(Input.text(line.get("id")));boolean keep=before!=null&&productId.equals(before.get("productId"));
            record.put("product_name",keep?before.get("productName"):product.get("name"));record.put("product_code",keep?before.get("productCode"):product.get("code"));
            record.put("length",amount.length());record.put("width",amount.width());record.put("dimension_unit",amount.unit());record.put("quantity",amount.pieces());record.put("surface",amount.surface());
            record.put(purchase?"unit_price":"unit_price_ttc",amount.price());record.put("tva_rate",amount.rate());record.put("line_total_ht",amount.ht());record.put("line_total_tva",amount.tva());record.put(purchase?"line_total":"line_total_ttc",amount.ttc());
            record.put("position",position++);record.put("subtotal_after",Boolean.TRUE.equals(line.get("subtotalAfter")));records.add(record);
            ht=ht.add(amount.ht());tva=tva.add(amount.tva());ttc=ttc.add(amount.ttc());
        }
        if(ttc.compareTo(new BigDecimal("999999999999.99"))>0)throw new BadRequestException("Total du document trop élevé");
        if(id!=null&&ttc.compareTo(paid(purchase,id))<0)throw new BadRequestException("Le total ne peut pas être inférieur aux paiements enregistrés");
        if(purchase&&status.equals("CANCELLED")&&id!=null&&paid(true,id).signum()>0)throw new BadRequestException("Corrigez les paiements avant d'annuler le bon");
        // Allocate only after validating the request, and keep the sequence lock until commit.
        if(!purchase){
            if(id!=null)preserveInvoiceNumber(old.get("code").toString());
            boolean sameMonth=id!=null&&YearMonth.from(Input.date(old.get("date"))).equals(YearMonth.from(date));
            code=sameMonth?old.get("code").toString():nextCode(false,date);
        }
        var affected=new HashSet<String>();for(var record:records)affected.add(record.get("product_id").toString());for(var line:prior.values())affected.add(line.get("productId").toString());
        var stockBefore=stock.lock(affected);
        Map<String,Object> header=new LinkedHashMap<>();header.put("code",code);header.put("date",date);header.put(p+"_id",partyId);header.put("status",status);header.put("payment_method",method);header.put("total_ht",ht);header.put("total_tva",tva);header.put(totalColumn(purchase),ttc);
        if(!purchase)header.put("notes",Input.optional(merged.get("notes"),4000));
        header.put(p+"_snapshot",id!=null&&partyId.equals(old.get(p+"Id"))?old.get(p+"Snapshot"):encode(contact));
        var issuer=restricted?users.findById(creator.getOwnerAdminId()).orElseThrow(()->new BadRequestException("Administrateur introuvable")):creator;
        header.put("company_snapshot",id!=null?old.get("companySnapshot"):encode(UserResponse.from(issuer).company()));
        if(!purchase&&id==null)header.put("created_by",userId);
        if(id==null)id=db.insert(table,header);else{db.update(table,id,header);db.jdbc.update("DELETE FROM "+lines(purchase)+" WHERE "+fk(purchase)+"=?",id);}
        if(!purchase&&!old.isEmpty()&&!code.equals(old.get("code")))
            db.jdbc.update("UPDATE payments SET reference=? WHERE facture_id=?",code,id);
        for(var record:records){record.put(fk(purchase),id);db.insert(lines(purchase),record);}
        stock.validate(stockBefore);
        return get(purchase,id);
    }
    private String nextCode(boolean purchase,LocalDate date){
        if(!purchase){
            lockInvoiceSequence();
            int next=nextInvoiceSequence(date);
            storeInvoiceCounter(invoicePeriod(date),next);
            return invoiceCode(date,next);
        }
        String kind=purchase?"PURCHASE":"FACTURE";
        db.query("SELECT kind FROM document_sequences WHERE kind=? FOR UPDATE",kind);
        String prefix=purchase?"BA-"+date.toString().replace("-","")+"-":String.format("%02d%02d",date.getYear()%100,date.getMonthValue());
        var counters=db.query("SELECT last_value FROM document_counters WHERE kind=? AND prefix=?",kind,prefix);
        int maximum=0;
        if(counters.isEmpty()){
            // Bootstrap existing data once; afterwards even deleted numbers remain consumed.
            for(var row:db.query("SELECT code FROM "+table(purchase)+" WHERE code LIKE ?",prefix+"%")){
                String suffix=row.get("code").toString().substring(prefix.length());
                if(suffix.matches("[0-9]+"))try{maximum=Math.max(maximum,Integer.parseInt(suffix));}catch(NumberFormatException ignored){}
            }
            db.jdbc.update("INSERT INTO document_counters(kind,prefix,last_value) VALUES (?,?,?)",kind,prefix,maximum);
        }else maximum=((Number)counters.getFirst().get("lastValue")).intValue();
        if(maximum>=999999)throw new BadRequestException("Séquence de documents épuisée");
        db.jdbc.update("UPDATE document_counters SET last_value=? WHERE kind=? AND prefix=?",maximum+1,kind,prefix);
        return prefix+String.format(purchase?"%04d":"%03d",maximum+1);
    }
    private String invoicePeriod(LocalDate date){
        if(date.getYear()<1||date.getYear()>9999)throw new BadRequestException("Année de facture : de 0001 à 9999");
        return String.format(Locale.ROOT,"%02d-%04d",date.getMonthValue(),date.getYear());
    }
    private String legacyInvoicePeriod(LocalDate date){return String.format(Locale.ROOT,"%02d%02d",date.getYear()%100,date.getMonthValue());}
    private String invoiceCode(LocalDate date,int sequence){return String.format(Locale.ROOT,"%02d-%s",sequence,invoicePeriod(date));}
    private void lockInvoiceSequence(){db.query("SELECT kind FROM document_sequences WHERE kind='FACTURE' FOR UPDATE");}
    private int counterMaximum(String... periods){
        int maximum=0;
        for(String period:periods){
            var rows=db.query("SELECT last_value FROM document_counters WHERE kind='FACTURE' AND prefix=?",period);
            if(!rows.isEmpty())maximum=Math.max(maximum,((Number)rows.getFirst().get("lastValue")).intValue());
        }
        return maximum;
    }
    private int parsedInvoiceSequence(String value){
        // Never silently ignore an oversized historic number and then reuse a lower number.
        BigInteger sequence=new BigInteger(value);
        if(sequence.compareTo(BigInteger.valueOf(Integer.MAX_VALUE))>0)throw new BadRequestException("Séquence de factures épuisée");
        return sequence.intValue();
    }
    private int nextInvoiceSequence(LocalDate date){
        String period=invoicePeriod(date),legacy=legacyInvoicePeriod(date);
        int maximum=counterMaximum(period,legacy);
        var modernPattern=java.util.regex.Pattern.compile("^([0-9]+)-"+period+"$");
        var legacyPattern=java.util.regex.Pattern.compile("^"+legacy+"([0-9]+)$");
        // Inspect both formats even when a counter exists: imported records may be ahead of it.
        for(var row:db.query("SELECT code FROM factures WHERE code LIKE ? OR code LIKE ?","%-"+period,legacy+"%")){
            String code=row.get("code").toString();
            var modern=modernPattern.matcher(code);var old=legacyPattern.matcher(code);
            if(modern.matches())maximum=Math.max(maximum,parsedInvoiceSequence(modern.group(1)));
            else if(old.matches())maximum=Math.max(maximum,parsedInvoiceSequence(old.group(1)));
        }
        if(maximum==Integer.MAX_VALUE)throw new BadRequestException("Séquence de factures épuisée");
        return maximum+1;
    }
    private void storeInvoiceCounter(String period,int value){
        // Caller holds document_sequences/FACTURE, including when bootstrapping a missing month.
        if(db.jdbc.update("UPDATE document_counters SET last_value=CASE WHEN last_value<? THEN ? ELSE last_value END WHERE kind='FACTURE' AND prefix=?",value,value,period)==0)
            db.jdbc.update("INSERT INTO document_counters(kind,prefix,last_value) VALUES ('FACTURE',?,?)",period,value);
    }
    private void preserveInvoiceNumber(String code){
        var modern=java.util.regex.Pattern.compile("^([0-9]+)-([0-9]{2})-([0-9]{4})$").matcher(code);
        var legacy=java.util.regex.Pattern.compile("^([0-9]{2})(0[1-9]|1[0-2])([0-9]+)$").matcher(code);
        if(modern.matches()){
            int month=Integer.parseInt(modern.group(2)),year=Integer.parseInt(modern.group(3));
            if(month<1||month>12||year<1)return;
            lockInvoiceSequence();storeInvoiceCounter(modern.group(2)+"-"+modern.group(3),parsedInvoiceSequence(modern.group(1)));
        }else if(legacy.matches()){
            // Retain the actual encoded period, even if a legacy invoice's date was previously edited.
            lockInvoiceSequence();storeInvoiceCounter(legacy.group(1)+legacy.group(2),parsedInvoiceSequence(legacy.group(3)));
        }
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> invoiceNumberPreview(String suppliedDate,String invoiceId){
        if(Input.text(suppliedDate).isEmpty())throw new BadRequestException("Choisissez la date de facture");
        LocalDate date=Input.date(suppliedDate);invoicePeriod(date);
        if(!Input.text(invoiceId).isEmpty()){
            var invoice=db.get("factures",invoiceId);
            if(YearMonth.from(Input.date(invoice.get("date"))).equals(YearMonth.from(date)))
                return Map.of("code",invoice.get("code"),"date",date.toString(),"preserved",true);
        }
        // No row lock, insert, or update here: previews are advisory and never reserve a number.
        return Map.of("code",invoiceCode(date,nextInvoiceSequence(date)),"date",date.toString(),"preserved",false);
    }
    private String method(boolean purchase,Object input){return purchase?Input.choice(input,"CASH","CASH","BANK_TRANSFER","CHECK","CREDIT_CARD"):Input.choice(input,null,"ESPECE","VIREMENT","CHEQUE","LCN");}
    private BigDecimal paid(boolean purchase,String id){return db.jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM payments WHERE "+fk(purchase)+"=?",BigDecimal.class,id);}
    @Transactional
    public void delete(boolean purchase,String id){
        var document=db.lock(table(purchase),id);if(paid(purchase,id).signum()>0)throw new ConflictException("Un document avec paiements ne peut pas être supprimé");
        if(!purchase)preserveInvoiceNumber(document.get("code").toString());
        var ids=db.query("SELECT DISTINCT product_id FROM "+lines(purchase)+" WHERE "+fk(purchase)+"=?",id).stream().map(row->row.get("productId").toString()).toList();
        var before=stock.lock(ids);db.jdbc.update("DELETE FROM "+table(purchase)+" WHERE id=?",id);stock.validate(before);
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public List<Map<String,Object>> payments(boolean purchase,String id){db.get(table(purchase),id);return db.query("SELECT * FROM payments WHERE "+fk(purchase)+"=? ORDER BY date,created_at,id",id);}
    @Transactional
    public Map<String,Object> payment(boolean purchase,String id,String paymentId,Map<String,Object> body,boolean delete){
        var header=db.lock(table(purchase),id);
        if("CANCELLED".equals(header.get("status")))throw new BadRequestException("Bon annulé: paiement impossible");
        Map<String,Object> prior=paymentId==null?new LinkedHashMap<>():db.get("payments",paymentId);
        if(paymentId!=null&&!id.equals(prior.get(purchase?"bonAchatId":"factureId")))throw new ResourceNotFoundException("Paiement introuvable pour ce document");
        if(delete){db.jdbc.update("DELETE FROM payments WHERE id=?",paymentId);return Map.of(purchase?"bon":"facture",get(purchase,id),"message","Paiement supprimé");}
        Map<String,Object> merged=new LinkedHashMap<>(prior);merged.putAll(body);
        BigDecimal amount=Input.nonnegative(merged.get("amount"),"Paiement");if(amount.signum()==0||amount.scale()>2)throw new BadRequestException("Paiement strictement positif, au plus deux décimales");
        BigDecimal previous=paymentId==null?BigDecimal.ZERO:number(prior.get("amount"));
        if(paid(purchase,id).subtract(previous).add(amount).compareTo(number(header.get(totalKey(purchase))))>0)throw new BadRequestException("Le paiement dépasse le reste à payer");
        String method=method(purchase,merged.getOrDefault("method",header.get("paymentMethod")));if(method==null)method="ESPECE";
        LocalDateTime date=LocalDateTime.now();String supplied=Input.text(merged.get("date"));
        if(!supplied.isEmpty())try{date=supplied.length()==10?LocalDate.parse(supplied).atStartOfDay():LocalDateTime.parse(supplied.replace("Z",""));}catch(Exception ex){throw new BadRequestException("Date de paiement invalide");}
        Map<String,Object> record=new LinkedHashMap<>();record.put(fk(purchase),id);record.put("amount",amount);record.put("method",method);record.put("date",Timestamp.valueOf(date));record.put("note",Input.optional(merged.get("note"),2000));record.put("reference",header.get("code"));
        if(paymentId==null)paymentId=db.insert("payments",record);else db.update("payments",paymentId,record);
        return Map.of(purchase?"bon":"facture",get(purchase,id),"payment",db.get("payments",paymentId));
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> dashboard(){
        // Aggregate headers and payments independently to avoid multiplying totals by line/payment counts.
        var totals=db.query("SELECT COUNT(*) AS invoice_count,COALESCE(SUM(total_ttc),0) AS sales FROM factures").getFirst();
        BigDecimal received=db.jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM payments WHERE facture_id IS NOT NULL",BigDecimal.class);
        BigDecimal bought=db.jdbc.queryForObject("SELECT COALESCE(SUM(total_amount),0) FROM bon_achats WHERE status<>'CANCELLED'",BigDecimal.class);
        var result=new LinkedHashMap<String,Object>(Map.of("sales",totals.get("sales"),"purchases",bought,"remaining",number(totals.get("sales")).subtract(received),"paid",received,
            "invoiceCount",totals.get("invoiceCount"),"clientCount",db.jdbc.queryForObject("SELECT COUNT(*) FROM clients",Long.class),
            "supplierCount",db.jdbc.queryForObject("SELECT COUNT(*) FROM suppliers",Long.class),"recentInvoices",list(false,Map.of("limit","5"))));
        YearMonth current=YearMonth.from(LocalDate.now(ZoneId.of("Africa/Casablanca")));
        LocalDate start=current.minusMonths(11).atDay(1),end=current.plusMonths(1).atDay(1);
        // Aggregate invoice headers separately from payments: multiple lines/receipts must never multiply sales.
        var monthly=new LinkedHashMap<String,Map<String,Object>>();
        for(int i=0;i<12;i++){
            var month=current.minusMonths(11-i);var bucket=new LinkedHashMap<String,Object>();
            bucket.put("month",month.toString());bucket.put("sales",BigDecimal.ZERO);bucket.put("paid",BigDecimal.ZERO);
            bucket.put("invoiceCount",0L);bucket.put("activeClients",0L);monthly.put(month.toString(),bucket);
        }
        for(var row:db.query("SELECT EXTRACT(YEAR FROM date) AS year_number,EXTRACT(MONTH FROM date) AS month_number, SUM(total_ttc) AS sales,COUNT(*) AS invoice_count,COUNT(DISTINCT client_id) AS active_clients FROM factures WHERE date>=? AND date<? GROUP BY EXTRACT(YEAR FROM date),EXTRACT(MONTH FROM date)",start,end)){
            String key=YearMonth.of(((Number)row.get("yearNumber")).intValue(),((Number)row.get("monthNumber")).intValue()).toString();
            var bucket=monthly.get(key);bucket.put("sales",row.get("sales"));bucket.put("invoiceCount",row.get("invoiceCount"));bucket.put("activeClients",row.get("activeClients"));
        }
        for(var row:db.query("SELECT EXTRACT(YEAR FROM date) AS year_number,EXTRACT(MONTH FROM date) AS month_number,SUM(amount) AS paid FROM payments WHERE facture_id IS NOT NULL AND date>=? AND date<? GROUP BY EXTRACT(YEAR FROM date),EXTRACT(MONTH FROM date)",Timestamp.valueOf(start.atStartOfDay()),Timestamp.valueOf(end.atStartOfDay()))){
            String key=YearMonth.of(((Number)row.get("yearNumber")).intValue(),((Number)row.get("monthNumber")).intValue()).toString();
            monthly.get(key).put("paid",row.get("paid"));
        }
        result.put("monthly",new ArrayList<>(monthly.values()));result.put("currentMonth",monthly.get(current.toString()));
        result.put("previousMonth",monthly.get(current.minusMonths(1).toString()));
        var stockSummary=new LinkedHashMap<>(catalog.summary());stockSummary.put("lowStock",catalog.list("products",Map.of("lowStock","true","limit","5")));result.put("stock",stockSummary);
        return result;
    }
}
