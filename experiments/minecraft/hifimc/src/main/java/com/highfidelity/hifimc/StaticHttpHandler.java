package com.highfidelity.hifimc;

import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.compress.utils.Charsets;
import org.apache.commons.io.IOUtils;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;

import net.minecraft.util.ResourceLocation;

public class StaticHttpHandler extends AbstractHandler
{
	protected ResourceLocation webResource = new ResourceLocation(HifiMC.MOD_ID, "index.html");
	protected List<String> webContent;
    public StaticHttpHandler() {
    	try {
        	InputStream webSource = this.getClass().getResourceAsStream("/assets/" + webResource.getNamespace() + "/" + webResource.getPath());
			webContent = IOUtils.readLines(webSource, Charsets.UTF_8);
		} catch (IOException e) {
			e.printStackTrace();
		}
    }

    public void handle( String target,
                        Request baseRequest,
                        HttpServletRequest request,
                        HttpServletResponse response ) throws IOException,
                                                      ServletException
    {
        response.setContentType("text/html; charset=utf-8");
        response.setStatus(HttpServletResponse.SC_OK);

        PrintWriter out = response.getWriter();
        
        String HIFI_JWT = Config.CLIENT.hifiJwt.get();
        out.println("");
        for (String line : webContent) {
        	out.println(line.replaceAll("##HIFI_JWT##", HIFI_JWT));
        }

        baseRequest.setHandled(true);
    }
}
