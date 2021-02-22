# Minecraft Mod Example

## Developing

- Install Java 8 (OpenJDK, aka HotSpot) from [AdoptOpenJDK](https://adoptopenjdk.net/) or your local package manager
- Add Java 8 to your PATH
    - Windows Powershell: Set `JAVA_HOME` to the folder containing `java.exe`, or alternatively add that folder to your `PATH`
    - Unix-like: Use [jenv](https://www.jenv.be/) or [sdkman](https://sdkman.io/) to set the version of java to use for this directory
- Install a ForgeGradle-supported IDE such as [Eclipse](https://www.eclipse.org/getting_started/) or [IntelliJ Idea Community](https://www.jetbrains.com/idea/)
    - Eclipse: Select "Eclipse IDE For Java Developers" in the installation menu
- Prepare the IDE workspace using gradle
    - Eclipse:
        - Windows Powershell: `gradlew.bat genEclipseRuns eclipse`
        - Unix-like: `./gradlew genEclipseRuns eclipse`
    - IntelliJ Idea:
        - Windows Powershell: `gradlew.bat genIntellijRuns`
        - Unix-like: `./gradlew genIntellijRuns`
- Start your IDE and open your workspace, where you can edit, run, and debug the mod
    - Eclipse:
        - It is recommended to select a workspace folder at least one directory higher than this one, for example the `minecraft` folder in this repository.
        - Import this Minecraft mod into your workspace
            - In the Package Explorer, Select "Import Projects"
            - Select "General" > "Existing Projects into Workspace" and click "Next"
            - Next to "Select root directory", click "Browse" and select this folder
            - This directory should be listed and checked in the list of projects
            - Click "Finish"
    - IntelliJ Idea: You may see a "module not specified" error. To fix this, edit your Configurations and select your "main" module.
- Build the mod
    - Windows Powershell: `gradlew.bat build`
    - Unix-like: `./gradlew build`
    - The mod will be built at `build/libs/hifimc-VERSION.jar`
