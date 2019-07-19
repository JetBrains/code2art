const isFss = layer => layer.kind == 'fss' || layer.kind == 'fss-mirror';
const isFluid = layer => layer.kind == 'fluid';
const isNativeMetaballs = layer => layer.kind == 'native-metaballs';

module.exports = {fss: isFss, fluid: isFluid, nativeMetaballs: isNativeMetaballs};
