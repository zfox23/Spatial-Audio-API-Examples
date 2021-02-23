package com.highfidelity.hifimc;

import java.util.concurrent.LinkedBlockingQueue;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.jetty.server.Connector;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.NetworkTrafficServerConnector;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.ContextHandler;
import org.eclipse.jetty.server.handler.ContextHandlerCollection;
import org.eclipse.jetty.util.thread.ExecutorThreadPool;
import org.eclipse.jetty.websocket.server.WebSocketHandler;

import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.player.ClientPlayerEntity;
import net.minecraft.util.math.vector.Vector3d;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.event.TickEvent.ClientTickEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.ModLoadingContext;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.config.ModConfig;
import net.minecraftforge.fml.event.lifecycle.FMLClientSetupEvent;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;


// The value here should match an entry in the META-INF/mods.toml file
@Mod(HifiMC.MOD_ID)
public class HifiMC {
    public static final String MOD_ID = "hifimc";
    public static final Logger LOGGER = LogManager.getLogger(MOD_ID);
    public static final Config CONFIG = new Config();

    // Convenience method to create and configure a ContextHandler.
    private static ContextHandler createContextHandler(String contextPath, Handler wrappedHandler) {
        ContextHandler ch = new ContextHandler (contextPath);
        ch.setHandler(wrappedHandler);
        ch.clearAliasChecks();
        ch.setAllowNullPathInfo(true);
        return ch;
    }

    public HifiMC() {
    	ModLoadingContext.get().registerConfig(ModConfig.Type.CLIENT, Config.clientSpec);
    	
        // Register the doClientStuff method for modloading
        FMLJavaModLoadingContext.get().getModEventBus().addListener(this::doClientStuff);

        // Register ourselves for server and other game events we are interested in
        MinecraftForge.EVENT_BUS.register(this);
    }

    private void doClientStuff(final FMLClientSetupEvent event) {
        // do something that can only be done on the client
        // LOGGER.info("Got game settings {}", event.getMinecraftSupplier().get().gameSettings);

        String webhostname = "localhost";
        // String webhostname = "0.0.0.0";
        int webport = 7777;
        int maxconnections = 5;

        LinkedBlockingQueue<Runnable> queue = new LinkedBlockingQueue<Runnable>(maxconnections);
        ExecutorThreadPool pool = new ExecutorThreadPool(maxconnections, 2, queue);
        Server webServer = new Server(pool);

        NetworkTrafficServerConnector connector = new NetworkTrafficServerConnector(webServer);
        connector.setAcceptQueueSize(50);
        if(webhostname.equals("0.0.0.0") == false)
            connector.setHost(webhostname);
        connector.setPort(webport);
        webServer.setConnectors(new Connector[]{connector});
        webServer.setStopAtShutdown(true);


        ContextHandlerCollection handlers = new ContextHandlerCollection();

        WebSocketHandler wsh = new WebSocketHandler.Simple (LocationDataWebSocket.class);
        handlers.addHandler(createContextHandler("/locdata", wsh));

        handlers.addHandler(createContextHandler("/", new StaticHttpHandler()));

        webServer.setHandler(handlers);


        try {
            webServer.start();
            // webServer.join();
        } catch (Exception e) {
            System.out.println("------------------------ caught webServer exception");
            e.printStackTrace();
            System.out.println(e);
        }
    }

    @SubscribeEvent
    public void onLivingUpdateEvent(ClientTickEvent event) {
    	if (event.phase != TickEvent.Phase.END) {
    		return;
    	}
        @SuppressWarnings("resource")
		ClientPlayerEntity player = Minecraft.getInstance().player;
        if (player != null) {
            Vector3d pos = player.getEyePosition(0);
            float yaw = player.getRotationYawHead(); // degrees clockwise from north?
            LocationDataWebSocket.x = pos.x;
            LocationDataWebSocket.y = pos.y;
            LocationDataWebSocket.z = pos.z;
            LocationDataWebSocket.yaw = (-yaw + 180.0) % 360.0;
        }
    }
}
