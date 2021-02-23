package com.highfidelity.hifimc;

import java.io.IOException;
import java.io.PrintWriter;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;

public class StaticHttpHandler extends AbstractHandler
{
    public StaticHttpHandler() {
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

        out.println("" +
"<!doctype html>\n" +
"<html lang=\"en\">\n" +
"    <head>\n" +
"        <meta charset=\"utf-8\">\n" +
"        <title>High Fidelity Spatial Audio API Example - Simple</title>\n" +
"    </head>\n" +
"\n" +
"    <body style=\"width: 100%; height: 100%; margin: 0; padding: 0;\">\n" +
"        <button class=\"connectButton\" style=\"width: 100%; height: 200px; margin: 0;\" onclick=\"connectToHiFiAudio()\">Click to Connect</button>\n" +
"        <audio controls autoplay class=\"outputAudioEl\" style=\"width: 100%; height: 75px; margin: 30px 0 0 0;\"></audio>\n" +
"    </body>\n" +
"\n" +
"    <script src=\"https://hifi-spatial-audio-api.s3.amazonaws.com/releases/v0.2.8/HighFidelityAudio-latest.js\"></script>\n" +
"    <script>\n" +
"        let connectButton = document.querySelector('.connectButton');\n" +
"        async function connectToHiFiAudio(stream) {\n" +
"            connectButton.disabled = true;\n" +
"            connectButton.innerHTML = `Connecting...`;\n" +
"            let audioMediaStream;\n" +
"            try {\n" +
"                audioMediaStream = await navigator.mediaDevices.getUserMedia({ audio: HighFidelityAudio.getBestAudioConstraints(), video: false });\n" +
"            } catch (e) {\n" +
"                return;\n" +
"            }\n" +
"            let initialHiFiAudioAPIData = new HighFidelityAudio.HiFiAudioAPIData({\n" +
"                position: new HighFidelityAudio.Point3D({ \"x\": 0, \"y\": 0, \"z\": 0 }),\n" +
"                orientationEuler: new HighFidelityAudio.OrientationEuler3D({ \"pitch\": 0, \"yaw\": 0, \"roll\": 0 })\n" +
"            });\n" +
"            let hifiCommunicator = new HighFidelityAudio.HiFiCommunicator({\n" +
"                transmitRateLimitTimeoutMS: 10,\n" +
"                initialHiFiAudioAPIData: initialHiFiAudioAPIData\n" +
"            });\n" +
"            await hifiCommunicator.setInputAudioMediaStream(audioMediaStream);\n" +
"            const HIFI_AUDIO_JWT = \"" + Config.CLIENT.hifiJwt.get() + "\";\n" +
"            try {\n" +
"                await hifiCommunicator.connectToHiFiAudioAPIServer(HIFI_AUDIO_JWT);\n" +
"            } catch (e) {\n" +
"                console.error(`Error connecting to High Fidelity:\n${e}`);\n" +
"                connectButton.disabled = false;\n" +
"                connectButton.innerHTML = `Connection error. Retry?`;\n" +
"                return;\n" +
"            }\n" +
"            connectButton.innerHTML = `Connected!`;\n" +
"            document.querySelector(`.outputAudioEl`).srcObject = hifiCommunicator.getOutputAudioMediaStream();\n" +
"            document.querySelector(`.outputAudioEl`).play();\n" +
"\n" +
"            mcLocationWebSocket = new WebSocket('ws://localhost:7777/locdata');\n" +
"            mcLocationWebSocket.onmessage = function (event) {\n" +
"                console.log(event.data);\n" +
"                mcLoc = JSON.parse(event.data)\n" +
"                userData = {\n" +
"                    position: new HighFidelityAudio.Point3D({ \"x\": mcLoc.x/2.0, \"y\": mcLoc.y/2.0, \"z\": mcLoc.z/2.0 }),\n" +
"                    orientationEuler: new HighFidelityAudio.OrientationEuler3D({\n" +
"                            \"pitchDegrees\": 0,\n" +
"                            \"yawDegrees\": mcLoc.yaw,\n" +
"                            \"rollDegrees\": 0\n" +
"                        })\n" +
"                }\n" +
"                hifiCommunicator.updateUserDataAndTransmit(userData);\n" +
"            }\n" +
"        }\n" +
"    </script>\n" +
"</html>\n");

        baseRequest.setHandled(true);
    }
}
