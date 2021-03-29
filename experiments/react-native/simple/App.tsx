import React, { useState } from 'react';
import {
    Button,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    registerGlobals,
    mediaDevices
} from 'react-native-webrtc';

import {
    HiFiCommunicator
} from 'hifi-spatial-audio';

registerGlobals();

class ConnectDisconnectButton extends React.Component<{}, { isConnected: boolean, disabled: boolean, buttonText: string }> {
    constructor(props: any) {
        super(props);
        this.state = {
            isConnected: false,
            disabled: false,
            buttonText: "Connect"
        };
    }

    onConnectDisconnectButtonPressed() {
        // Disable the Connect button after the user clicks it so we don't double-connect.
        this.setState({ disabled: true });
        this.setState({ buttonText: "Connecting..." });

        let hiFiAudioJWT = "test";

        console.log(`Creating HiFiCommunicator...`);
        let hifiCommunicator = new HiFiCommunicator();

        // Get the audio media stream associated with the user's default audio input device.
        console.log(`Getting audio input stream...`);
        mediaDevices.getUserMedia({ audio: true, video: false })
            .then((inputMediaStream) => {
                console.log(`Setting audio input stream on HiFiCommunicator...`);
                hifiCommunicator.setInputAudioMediaStream(inputMediaStream);

                console.log(`Connecting to HiFi Audio API Server...`);
                hifiCommunicator.connectToHiFiAudioAPIServer(hiFiAudioJWT)
                    .then((response) => {
                        console.log(`Connected!`);
                        // Show the user that we're connected by changing the text on the button.
                        this.setState({ disabled: false });
                        this.setState({ buttonText: `Connected!` });
                
                        // // Set the `srcObject` on our `audio` DOM element to the final, mixed audio stream from the High Fidelity Audio API Server.
                        // document.querySelector(`.outputAudioEl`).srcObject = hifiCommunicator.getOutputAudioMediaStream();
                        // // We explicitly call `play()` here because certain browsers won't play the newly-set stream automatically.
                        // document.querySelector(`.outputAudioEl`).play();
                    })
                    .catch((e) => {
                        console.error(`Error connecting to High Fidelity:\n${e}`);
                        this.setState({ disabled: false });
                        this.setState({ buttonText: `Connection error. Retry?` });
                    })
            })
            .catch((e) => {
                console.error(`Error getting \`audioMediaStream\`:\n${e}`);
            })
    }

    render() {
        return (
            <Button
                title={this.state.buttonText}
                onPress={this.onConnectDisconnectButtonPressed.bind(this)}
                disabled={this.state.disabled}
            />
        );
    }
}

const App = () => {
    return (
        <SafeAreaView style={styles.container}>
            <View>
                <Text style={styles.title}>
                    React Native & HiFi Spatial Audio
                </Text>
                <ConnectDisconnectButton />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        marginHorizontal: 16
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        textAlign: 'center'
    },
});

export default App;
