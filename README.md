# rn-image-recycled-view-stale-image

![Build](https://github.com/mattijsf/rn-image-recycled-view-stale-image/workflows/Pre%20Merge%20Checks/badge.svg)

Reproducer for an iOS (new architecture) bug where an `<Image>` shows the picture of another `<Image>` that was unmounted just before. The component's other content is correct, only the image is wrong, and it happens intermittently.

- Snack: https://snack.expo.dev/@mattijsf/image-recycle-stale-load-ios
- Issue: TBD

## What the app does

The whole reproducer is in [`ReproducerApp/App.tsx`](ReproducerApp/App.tsx) and only uses `react-native`.

Each round mounts 64 red images (96x96, unique URLs, so never cached). As soon as the first one has loaded, all of them are replaced with a green image (64x64, one URL, prefetched and cached). The red and green images are different elements, so the red native views are recycled and reused by the green ones in the same commit.

After 50 rounds (about a minute) the run stops and the last green round stays on screen.

Expected: every tile is green during the green phase, and the counters stay at 0.

Actual on iOS: some tiles stay red. A wrong image is counted when a green tile's `onLoad` reports the red image's width (96) instead of 64. On an iPhone one run had a wrong image in 32 of 50 rounds, 111 wrong images in total. In the iOS simulator (Release build, iPhone 17 Pro Max, iOS 26.5): 39 of 50 rounds, 323 wrong images. The same app on Android: 0 of 50.

## Why it happens

`RCTImageResponseObserverProxy::didReceiveImage` dispatches to the main queue before calling the view. If the view is recycled and reused by another `<Image>` while that block is waiting, `RCTImageComponentView`'s `didReceiveImage` applies the old image, because it only checks that the view has a state, not that the image belongs to its current request. When the new image was cached, it was already applied during mount, so the late old image stays.

## Running it

This project was created from the [React Native reproducer template](https://github.com/react-native-community/reproducer-react-native) and is a vanilla React Native app. You need a working [React Native environment](https://reactnative.dev/docs/set-up-your-environment).

```bash
cd ReproducerApp
yarn install
cd ios && bundle install && bundle exec pod install && cd ..
yarn ios
```

Tap Start once it is enabled (it first prefetches the green image) and watch the counters. The effect is timing dependent, but it shows up on both a real iPhone and the simulator.
