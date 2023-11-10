/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React, { useEffect, useState, useRef } from 'react';
import firebase from '@react-native-firebase/app';
import firestore from '@react-native-firebase/firestore';
import {
  Button,
  SafeAreaView,
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
  RTCView,
} from 'react-native-webrtc';

const App = () => {
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [webcamStarted, setWebcamStarted] = useState(false);
  const [channelId, setChannelId] = useState(null);
  const [peerConnection, _] = useState(
    new RTCPeerConnection({
      iceServers: [
        {
          "credential": "turn456",
          "urls": [
            "turn:3.208.30.246:3478",
          ],
          "username": "turnuserlgmk"
        },
      ],
    })
  );

	// Start call
	const startCall = async () => {
    const channelDoc = firestore().collection('channels').doc();
    const offerCandidates = channelDoc.collection('offerCandidates');
    const answerCandidates = channelDoc.collection('answerCandidates');

    setChannelId(channelDoc.id);

    // Get candidate for caller, save to db
    peerConnection.addEventListener( 'icecandidate', async event => {
      if (event.candidate ) { 
        await offerCandidates.add(event.candidate.toJSON());
      };
    });

    //create offer
    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await channelDoc.set({offer});

    // Listen for remote answer
    channelDoc.onSnapshot(snapshot => {
      const data = snapshot.data();
      if (!peerConnection.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        peerConnection.setRemoteDescription(answerDescription);
      }
    });

    // When answered, add candidate to peer connection
    answerCandidates.onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if(change.type === 'added'){
          const data = change.doc.data();
          peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

	// join call
	const joinCall = async () => {
    const channelDoc = firestore().collection('channels').doc(channelId);
    const offerCandidates = channelDoc.collection('offerCandidates');
    const answerCandidates = channelDoc.collection('answerCandidates');

    peerConnection.addEventListener( 'icecandidate', async event => {
      if (event.candidate ) { 
        await answerCandidates.add(event.candidate.toJSON());
      };
    });

    const channelDocument = await channelDoc.get();
    const channelData = channelDocument.data();

    const offerDescription = channelData.offer;
    const offerDescriptionRemote = new RTCSessionDescription( offerDescription );
	  await peerConnection.setRemoteDescription( offerDescriptionRemote );

    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await channelDoc.update({answer});

    offerCandidates.onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        peerConnection.addIceCandidate(new RTCIceCandidate(data));
      });
    });
  };

	// start web cam
	const startWebcam = async () => {
		const local = await mediaDevices.getUserMedia({
			video: true,
			audio: true,
		});
		setLocalStream(local);

    const remote = new MediaStream();
    setRemoteStream(remote);

    // Add our stream to the peer connection.
    local.getTracks().forEach(track => {
      peerConnection.addTrack( track, local );
    });

    peerConnection.addEventListener( 'track', event => {
      remote.addTrack( event.track, remote );
      setRemoteStream(event.streams[0])
    });
    
		setWebcamStarted(true);
	};

  useEffect(() => {
    const firebaseConfig = {
      apiKey: "AIzaSyD2eeT-2_acai9cM7NYUfpT_bZb1abAZGg",
      authDomain: "webrtc-lgmk.firebaseapp.com",
      projectId: "webrtc-lgmk",
      storageBucket: "webrtc-lgmk.appspot.com",
      messagingSenderId: "409467482902",
      appId: "1:409467482902:web:75866c5d4782190b8b5637",
      measurementId: "G-DE3STEQ401"
    };
    firebase.initializeApp(firebaseConfig);
  }, []);

  useEffect(() => {
    console.log('Local Stream', localStream?.toURL());
  }, [localStream]);

  useEffect(() => {
    console.log('Remote Stream', remoteStream?.toURL())
  }, [remoteStream]);

  return (
    <KeyboardAvoidingView style={styles.body} behavior="position">
      <SafeAreaView>
        {localStream && (
          <RTCView
            streamURL={localStream?.toURL()}
            style={styles.stream}
            objectFit="cover"
            mirror
          />
        )}

        {remoteStream && (
          <RTCView
            streamURL={remoteStream?.toURL()}
            style={styles.stream}
            objectFit="cover"
            mirror
          />
        )}
        <View style={styles.buttons}>
          {!webcamStarted && (
            <Button title="Start webcam" onPress={startWebcam} />
          )}
          {webcamStarted && <Button title="Start call" onPress={startCall} />}
          {webcamStarted && (
            <View style={{flexDirection: 'row'}}>
              <Button title="Join call" onPress={joinCall} />
              <TextInput
                value={channelId}
                placeholder="callId"
                minLength={45}
                style={{borderWidth: 1, padding: 5}}
                onChangeText={newText => setChannelId(newText)}
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  body: {
    backgroundColor: '#fff',

    justifyContent: 'center',
    alignItems: 'center',
    ...StyleSheet.absoluteFill,
  },
  stream: {
    flex: 2,
    width: 200,
    height: 200,
  },
  buttons: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
});

export default App;
