package com.example.examplemod;


import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketClose;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketConnect;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketError;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketMessage;
import org.eclipse.jetty.websocket.api.annotations.WebSocket;


@WebSocket
public class LocationDataWebSocket {

    private final ScheduledExecutorService executorService = Executors.newScheduledThreadPool(1);

    static double x;
    static double y;
    static double z;
    static double yaw;

    @OnWebSocketClose
    public void onClose(int statusCode, String reason) {
        System.out.println("Close: " + reason);
    }

    @OnWebSocketError
    public void onError(Throwable t) {
        System.out.println("Error: " + t.getMessage());
    }

    @OnWebSocketConnect
    public void onConnect(Session session) {
        System.out.println("Connect: " + session.getRemoteAddress().getAddress());

        executorService.scheduleAtFixedRate(() -> {
                try {
                    String data = "Ping";
                    ByteBuffer payload = ByteBuffer.wrap(data.getBytes());
                    session.getRemote().sendPing(payload);
                } catch (IOException e) {
                    e.printStackTrace();
                }
            },
            5, 5, TimeUnit.SECONDS);


        executorService.scheduleAtFixedRate(() -> {
                try {
                    session.getRemote().sendString("{" +
                                                   "\"x\":" + x + ", " +
                                                   "\"y\":" + y + ", " +
                                                   "\"z\":" + z + ", " +
                                                   "\"yaw\": " + yaw + "} ");

                } catch (IOException e) {
                    try {
                        session.getRemote().sendString(e.toString());
                    } catch (IOException ef) {
                    }
                }
            },
            100, 100, TimeUnit.MILLISECONDS);
    }

    @OnWebSocketMessage
    public void onMessage(String message) {
        System.out.println("Message: " + message);
    }
}
