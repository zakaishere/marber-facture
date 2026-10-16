package com.stock.management.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.*;
import org.springframework.mock.web.*;
import static org.assertj.core.api.Assertions.*;

class SpaFilterTest {
    private final ResourceLoader resources=new DefaultResourceLoader(){
        @Override public Resource getResource(String location){return new ByteArrayResource("<html></html>".getBytes());}
    };
    @Test void browserDeepLinkUsesReactIndex()throws Exception{
        var request=new MockHttpServletRequest("GET","/factures/id/edit");request.setServletPath("/factures/id/edit");request.addHeader("Accept","text/html");var response=new MockHttpServletResponse();
        new SpaFilter(resources).doFilter(request,response,new MockFilterChain());
        assertThat(response.getForwardedUrl()).isEqualTo("/index.html");
    }
    @Test void jsonApiIsNotForwarded()throws Exception{
        var request=new MockHttpServletRequest("GET","/factures");request.setServletPath("/factures");request.addHeader("Accept","application/json");var response=new MockHttpServletResponse();
        new SpaFilter(resources).doFilter(request,response,new MockFilterChain());
        assertThat(response.getForwardedUrl()).isNull();
    }
}
