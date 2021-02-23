# Minecraft Mod Example

This simple Minecraft mod allows you to experience High Fidelity's spatial audio while playing Minecraft with others. The mod will allow you to hear spatial audio from other players who also have the mod installed and are connected to the same audio space.

## Developing

1. Install Java 8 (OpenJDK, aka HotSpot) from [AdoptOpenJDK](https://adoptopenjdk.net/) or your local package manager
2. Add Java 8 to your PATH
    - Windows Powershell: Set `JAVA_HOME` to the folder containing `java.exe`, or alternatively add that folder to your `PATH`
    - Unix-like: Use [jenv](https://www.jenv.be/) or [sdkman](https://sdkman.io/) to set the version of java to use for this directory
3. Install a ForgeGradle-supported IDE such as [Eclipse](https://www.eclipse.org/getting_started/) or [IntelliJ Idea Community](https://www.jetbrains.com/idea/)
    - Eclipse: Select "Eclipse IDE For Java Developers" in the installation menu
4. Prepare the IDE workspace using gradle
    - Eclipse:
        - Windows Powershell: `gradlew.bat genEclipseRuns eclipse`
        - Unix-like: `./gradlew genEclipseRuns eclipse`
    - IntelliJ Idea:
        - Windows Powershell: `gradlew.bat genIntellijRuns`
        - Unix-like: `./gradlew genIntellijRuns`
5. Start your IDE and open your workspace, where you can edit the mod
    - Eclipse:
        - It is recommended to select a workspace folder at least one directory higher than this one, for example the `minecraft` folder in this repository.
        - Import this Minecraft mod into your workspace
            - In the Package Explorer, Select "Import Projects"
            - Select "General" > "Existing Projects into Workspace" and click "Next"
            - Next to "Select root directory", click "Browse" and select this folder
            - This directory should be listed and checked in the list of projects
            - Click "Finish"
    - IntelliJ Idea: You may see a "module not specified" error. To fix this, edit your Configurations and select your "main" module.
6. Build the mod
    - Windows Powershell: `gradlew.bat build`
    - Unix-like: `./gradlew build`
    - The mod will be built at `build/libs/hifimc-VERSION.jar`

## Usage

1. After the mod is built at `build/libs/hifimc-VERSION.jar`, copy it to your `.minecraft/mods` folder, or the `mods` folder of your instance as applicable for your Minecraft launcher.
2. Configure your modded instance to use the audio space JWT of your choice in `.minecraft/config/hifimc-client.toml`. An example config file is provided below:
```
#Client configuration settings
[general]
    #Defines the JWT to use to connect to a High Fidelity audio space.
    #Visit localhost:7777 in a web browser when the mod is loaded to connect to the space.
    hifiJwt = "MY_HIFI_JWT"
```
3. Start your Minecraft client, connecting to a Minecraft server, and open a browser tab to `localhost:7777` to have spatial audio while playing Minecraft.

## Limitations/Caveats

- As the High Fidelity API currently does not support streaming audio in the Java programming language, you will need to have a web browser tab open to send and receive audio. Please see [this list](https://www.highfidelity.com/knowledge/what-devices-are-compatible) of currently supported web browsers.
- As the JWT is configured on startup, you will use the same audio space regardless of which world or dimension you are in.
- This mod is only suitable for use on the Minecraft client and does not need to be installed on a Minecraft server.

