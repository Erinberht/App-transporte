// Extiende app.json con valores que vienen de variables de entorno (.env).
// app.json no puede leer variables de entorno: https://docs.expo.dev/versions/v58.0.0/sdk/map-view/
//
// GOOGLE_MAPS_ANDROID_API_KEY: necesaria para que el mapa se vea en builds de Android
// (development build / tienda). En Expo Go no hace falta.
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY }],
  ],
});
