import { Capacitor } from "@capacitor/core";
import { AdMob, InterstitialAdPluginEvents } from "@capacitor-community/admob";

const INTERSTITIAL_ID = "ca-app-pub-2333791456693293/7692598192";
const REWARDED_ID = "ca-app-pub-2333791456693293/7422893048";

let initialized = false;
let interstitialListenersReady = false;

export async function initializeAds() {
  if (!interstitialListenersReady && Capacitor.isNativePlatform()) {
    interstitialListenersReady = true;
    await AdMob.addListener(InterstitialAdPluginEvents.Loaded, (info) => {
      console.log("MazeX interstitial LOADED:", info);
    });
    await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (error) => {
      console.warn("MazeX interstitial FAILED TO LOAD:", error);
    });
    await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (error) => {
      console.warn("MazeX interstitial FAILED TO SHOW:", error);
    });
  }
  if (!Capacitor.isNativePlatform() || initialized) return;

  await AdMob.initialize();
  initialized = true;

  await prepareInterstitial();
  await prepareRewarded();
}

export async function prepareInterstitial() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await AdMob.prepareInterstitial({
      adId: INTERSTITIAL_ID,
      isTesting: false,
    });
  } catch (error) {
    console.warn("MazeX interstitial preparation failed:", error);
  }
}

export async function showInterstitial() {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    await AdMob.showInterstitial();
    await prepareInterstitial();
    return true;
  } catch (error) {
    console.warn("MazeX interstitial failed:", error);
    return false;
  }
}

export async function prepareRewarded() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await AdMob.prepareRewardVideoAd({
      adId: REWARDED_ID,
      isTesting: false,
    });
  } catch (error) {
    console.warn("MazeX rewarded ad preparation failed:", error);
  }
}

export async function showRewardedForLives() {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    await AdMob.showRewardVideoAd();
    await prepareRewarded();
    return true;
  } catch (error) {
    console.warn("MazeX rewarded ad was not completed:", error);
    return false;
  }
}



