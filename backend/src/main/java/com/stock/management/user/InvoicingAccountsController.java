package com.stock.management.user;

import com.stock.management.common.error.*;
import com.stock.management.common.id.IdGenerator;
import com.stock.management.invoicing.Store;
import java.security.Principal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/auth/accounts")
public class InvoicingAccountsController {
    private final UserRepository users; private final PasswordEncoder encoder; private final IdGenerator ids; private final Store db;
    public InvoicingAccountsController(UserRepository users,PasswordEncoder encoder,IdGenerator ids,Store db){this.users=users;this.encoder=encoder;this.ids=ids;this.db=db;}
    private Map<String,Object> view(User user){return Map.of("id",user.getId(),"username",user.getUsername(),"role",user.getRole().name(),"enabled",user.isEnabled());}
    @GetMapping public List<Map<String,Object>> list(Principal p){return users.findByOwnerAdminIdOrderByUsernameAsc(p.getName()).stream().filter(u->u.getRole()==Role.ROLE_INVOICING).map(this::view).toList();}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
    public Map<String,Object> create(Principal p,@RequestBody Map<String,Object> body){
        User user=new User();user.setId(ids.next());user.setRole(Role.ROLE_INVOICING);user.setOwnerAdminId(p.getName());
        apply(user,body,true);return view(users.saveAndFlush(user));
    }
    @PutMapping("/{id}") @Transactional
    public Map<String,Object> update(Principal p,@PathVariable String id,@RequestBody Map<String,Object> body){
        db.lock("users",id);User user=users.findById(id).orElseThrow(()->new ResourceNotFoundException("Compte introuvable"));
        if(user.getRole()!=Role.ROLE_INVOICING || !p.getName().equals(user.getOwnerAdminId()))throw new ResourceNotFoundException("Compte introuvable");
        apply(user,body,false);user.setTokenVersion(user.getTokenVersion()+1);return view(users.saveAndFlush(user));
    }
    private void apply(User user,Map<String,Object> body,boolean create){
        if(body.keySet().stream().anyMatch(key->!Set.of("username","password","enabled").contains(key)))throw new BadRequestException("Seuls le nom, le mot de passe et l'état du compte sont modifiables");
        if(create||body.containsKey("username")){
            String username=Objects.toString(body.get("username"),"").trim();
            if(!username.matches("[A-Za-z0-9._-]{3,50}"))throw new BadRequestException("Identifiant : 3 à 50 lettres, chiffres, points, tirets ou underscores");
            users.findByUsername(username).ifPresent(other->{if(!other.getId().equals(user.getId()))throw new ConflictException("Cet identifiant est déjà utilisé");});user.setUsername(username);
        }
        if(create||body.containsKey("password")){
            String password=Objects.toString(body.get("password"),"");
            if(password.length()<10 || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72)throw new BadRequestException("Mot de passe : au moins 10 caractères et au plus 72 octets");
            user.setPasswordHash(encoder.encode(password));
        }
        if(body.containsKey("enabled")){if(!(body.get("enabled") instanceof Boolean))throw new BadRequestException("État du compte invalide");user.setEnabled((Boolean)body.get("enabled"));}
    }
}
