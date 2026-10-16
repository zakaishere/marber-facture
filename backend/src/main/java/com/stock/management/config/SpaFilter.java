package com.stock.management.config;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Allows refreshing React routes when the built frontend is served by Spring.
 * JSON API requests keep the legacy URLs and are never forwarded. */
@Component @Order(Ordered.HIGHEST_PRECEDENCE)
public class SpaFilter extends OncePerRequestFilter {
    private final ResourceLoader resources;
    public SpaFilter(ResourceLoader resources){this.resources=resources;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
        String accept=request.getHeader("Accept");String path=request.getServletPath();
        boolean route=path.equals("/")||path.matches("/(login|profile|accounts|products|categories|clients|suppliers|factures|bon-achat)(/.*)?");
        if(request.getMethod().equals("GET")&&accept!=null&&accept.contains("text/html")&&route&&resources.getResource("classpath:static/index.html").exists()){
            request.getRequestDispatcher("/index.html").forward(request,response);return;
        }
        chain.doFilter(request,response);
    }
}
