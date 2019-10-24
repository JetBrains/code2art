const deepClone = require('./deep-clone.js');
const C = require('./constants.js');
const is = require('./check-layer-type.js');
const randomize = require('./randomize.js');
const dat = require('dat.gui');

const update = (gui) => () => {
  for (var i in gui.__controllers) {
    gui.__controllers[i].updateDisplay();
  }
  for (var i in gui.__folders) {
    update(gui.__folders[i])();
  }
}

const getSizeSet = (mode, constants) => {
  const modeValues = constants['sizes'].filter(s => s.mode == mode);
  if (modeValues.length < 1) return [];
  let sizeSet = {};
  modeValues[0]['values'].forEach(value => {
    sizeSet[value.label] = value.code;
  });
  sizeSet['browser'] = 'browser';
  return sizeSet;
}

const Config = function(layers, defaults, constants, funcs, randomize) {
    const customAdd = C.BLEND_FUNCS['+'];
    const one = C.BLEND_FACTORS['1'];
    const zero = C.BLEND_FACTORS['0'];

    const mode = defaults.mode;
    this.product = defaults.product;


    const sizePresetSet = getSizeSet(mode, constants);

    layers.forEach((layer, index) => {
      if (layer.kind == 'webgl') {
        if (mode !== 'prod') {
          if (layer.blend[0]) {
            const blend = layer.blend[0];
            this['blendColor' + index] = blend.color || [ 1, 0, 0, 0 ]; // FIXME: get RGBA components
            this['blendColorEqFn' + index] = C.BLEND_FUNCS[C.funcKeys[blend.colorEq[0]]];
            this['blendColorEqFactor0' + index] = C.BLEND_FACTORS[C.factorKeys[blend.colorEq[1]]];
            this['blendColorEqFactor1' + index] = C.BLEND_FACTORS[C.factorKeys[blend.colorEq[2]]];
            this['blendAlphaEqFn' + index] = C.BLEND_FUNCS[C.funcKeys[blend.alphaEq[0]]];
            this['blendAlphaEqFactor0' + index] = C.BLEND_FACTORS[C.factorKeys[blend.alphaEq[1]]];
            this['blendAlphaEqFactor1' + index] = C.BLEND_FACTORS[C.factorKeys[blend.alphaEq[2]]];
          } else {
            this['blendColor' + index] = [ 0, 0, 0, 0 ];
            this['blendColorEqFn' + index] = customAdd;
            this['blendColorEqFactor0' + index] = one;
            this['blendColorEqFactor1' + index] = zero;
            this['blendAlphaEqFn' + index] = customAdd;
            this['blendAlphaEqFactor0' + index] = one;
            this['blendAlphaEqFactor1' + index] = zero;
          }

        } else { // mode == 'prod'
          this['blendSet' + index] = C.BLEND_SETS['soft'];
          this['blendColor' + index] =
              layer.blend[0].color || [ 1, 0, 0, 0 ]; // FIXME: get RGBA components
        }
      } else { // kind != 'webgl'
          if (!is.background(layer)) {
            this['layer' + index + 'Blend'] = layer.blend[1] || 'normal';
          }
      }

      this['visible' + index] = !!layer.isOn;
      this['opacity' + index] = layer.opacity;

      if (is.fss(layer)) {
        this['mirror' + index] =  layer.model.mirror;
        this['renderMode' + index] = 'triangles';
        this['lightSpeed' + index] = layer.model.lightSpeed;
        this['facesX' + index] = layer.model.faces.x;
        this['facesY' + index] = layer.model.faces.y;
        this['vignette' + index] = layer.model.vignette;
        this['iris' + index] = layer.model.iris;
        this['amplitudeX' + index] = layer.model.amplitude[0];
        this['amplitudeY' + index] = layer.model.amplitude[1];
        this['amplitudeZ' + index] = layer.model.amplitude[2];
        this['opacity' + index] = layer.model.opacity;
        this['hue' + index] = layer.model.colorShift[0];
        this['saturation' + index] = layer.model.colorShift[1];
        this['brightness' + index] = layer.model.colorShift[2];
      }

      if (is.cover(layer)) {
        this['productShown'+index] = !!layer.model.productShown;
      }

      if (is.fluid(layer) || is.nativeMetaballs(layer)) {

        if (is.fluid(layer)) {
          this['bang' + index] = () => funcs.refreshFluid(index);
          this['rebuildGradients' + index] = () => funcs.rebuildFluidGradients(index);
        }
        if (is.nativeMetaballs(layer)) {
          this['bang' + index] = () => funcs.refreshNativeMetaballs(index);
        }
        this['variety'+index] = layer.model.variety;
        this['orbit'+index] = layer.model.orbit;
        this['blur'+index] = layer.model.effects.blur;
        this['fat'+index] = layer.model.effects.fat;
        this['ring'+index] = layer.model.effects.ring;
      }

      if (is.background(layer)) {
        const stopStates = layer.model.stops || [];
        const gradientType = layer.model.orientation || "linear";
        this['isRadial'+index] = gradientType == "radial";
        this['stop1'+index] = stopStates[0] == "on";
        this['stop2'+index] = stopStates[1] == "on";
        this['stop3'+index] = stopStates[2] == "on";
      }
    });

    //this.customSize = sizePresetSet['browser'];
    this.sizePreset = sizePresetSet['browser'];

    //this.savePng = funcs.savePng;
    this.saveBatch = () => funcs.saveBatch(Object.values(sizePresetSet));
    // this.randomize = randomize(this); // FIXME: this way we updated FSS using "I feel lucky", consider returning it back in some way

    this.randomize = () => funcs.iFeelLucky();

    // -------
    //this.timeShift = 0;
    // this.getSceneJson = funcs.getSceneJson;
    // this.loadSceneJson = funcs.loadSceneJson;
    //this.exportZip = funcs.exportZip;
};

function start(document, model, constants, funcs) {
    const defaults = model;
    const { mode, layers } = model;

    const sizePresetSet = getSizeSet(mode, constants);
    const products = constants.products;
    const productToId = {};
    products.forEach((product) => {
        productToId[product.label] = product.id;
    });
    const productsById = {};
    products.forEach((product) => {
      productsById[product.id] = product;
    });


    function updateProduct(id) {
      const product = productsById[id];
      funcs.changeProduct(product.id);
    }

    function switchLayer(index) {
      return function(on) {
        if (on) funcs.turnOn(index);
        else funcs.turnOff(index);
      }
    }

    function switchMirror(index, on) {
      if (on) funcs.mirrorOn(index);
      else funcs.mirrorOff(index);
    }

    function updateWebGLBlend(index, f) {
      return function(value) {
        const color = config['blendColor'+index];
        const curBlend =
          { color: { r: color[0], g: color[1], b: color[2], a: color[3] }
          , colorEq: [ C.BLEND_FUNCS_IDS[config['blendColorEqFn'+index]]
                     , C.BLEND_FACTORS_IDS[config['blendColorEqFactor0'+index]]
                     , C.BLEND_FACTORS_IDS[config['blendColorEqFactor1'+index]]
                     ]
          , alphaEq: [ C.BLEND_FUNCS_IDS[config['blendAlphaEqFn'+index]]
                     , C.BLEND_FACTORS_IDS[config['blendAlphaEqFactor0'+index]]
                     , C.BLEND_FACTORS_IDS[config['blendAlphaEqFactor1'+index]]
                     ]
          }
        const newBlend = f(curBlend, value);
        funcs.changeWGLBlend(index, newBlend);
      }
    }

    function addWebGLBlend(folder, config, layer, index) {
      if (mode !== 'prod') {

        const blendFolder = folder.addFolder('blend');
        const color = blendFolder.addColor(config, 'blendColor' + index);
        const colorEqFn = blendFolder.add(config, 'blendColorEqFn' + index, C.BLEND_FUNCS);
        const colorEqFactor0 =
            blendFolder.add(config, 'blendColorEqFactor0' + index, C.BLEND_FACTORS);
        const colorEqFactor1 =
            blendFolder.add(config, 'blendColorEqFactor1' + index, C.BLEND_FACTORS);
        const alphaEqFn =
            blendFolder.add(config, 'blendAlphaEqFn' + index, C.BLEND_FUNCS);
        const alphaEqFactor0 =
            blendFolder.add(config, 'blendAlphaEqFactor0' + index, C.BLEND_FACTORS);
        const alphaEqFactor1 =
            blendFolder.add(config, 'blendAlphaEqFactor1' + index, C.BLEND_FACTORS);
        //folder.open();

        color.onFinishChange(updateWebGLBlend(index, (blend, value) => {
          blend.color = { r: value[0], g: value[1], b: value[2], a: value[3] }
          return blend;
        }));
        colorEqFn.onFinishChange(updateWebGLBlend(index, (blend, value) => {
          blend.colorEq[0] = C.BLEND_FUNCS_IDS[value];
          return blend;
        }));
        colorEqFactor0.onFinishChange(updateWebGLBlend(index, (blend, value) => {
          blend.colorEq[1] = C.BLEND_FACTORS_IDS[value];
          return blend;
        }));
        colorEqFactor1.onFinishChange(updateWebGLBlend(index, (blend, value) => {
          blend.colorEq[2] = C.BLEND_FACTORS_IDS[value];
          return blend;
        }));
        alphaEqFn.onFinishChange(updateWebGLBlend(index, (blend, value) => {
          blend.alphaEq[0] = C.BLEND_FUNCS_IDS[value];
          return blend;
        }));
        alphaEqFactor0.onFinishChange(updateWebGLBlend(index, (blend, value) => {
          blend.alphaEq[1] = C.BLEND_FACTORS_IDS[value];
          return blend;
        }));
        alphaEqFactor1.onFinishChange(updateWebGLBlend(index, (blend, value) => {
          blend.alphaEq[2] = C.BLEND_FACTORS_IDS[value];
          return blend;
        }));

      } else { // mode == 'prod'

        const blendSet = folder.add(config, 'blendSet' + index, C.BLEND_SETS).name('blend');
        // const blendColor = folder.addColor(config, 'blendColor' + index).name('color');

        // blendColor.onFinishChange(updateWebGLBlend(index, (blend, value) => {
        //   blend.color = { r: value[0], g: value[1], b: value[2], a: value[3] }
        //   return blend;
        // }));

        blendSet.onFinishChange((value) => {
          blendConfig = value.split(',');

          const color = config['blendColor'+index] || [ 0, 0, 0, 1 ];
          const newBlend =
          { color: { r: color[0], g: color[1], b: color[2], a: color[3] }
          , colorEq: [ C.BLEND_FUNCS_IDS[C.BLEND_FUNCS[blendConfig[0]]]
                     , C.BLEND_FACTORS_IDS[C.BLEND_FACTORS[blendConfig[1]]]
                     , C.BLEND_FACTORS_IDS[C.BLEND_FACTORS[blendConfig[2]]]
                     ]
          , alphaEq: [ C.BLEND_FUNCS_IDS[C.BLEND_FUNCS[blendConfig[3]]]
                     , C.BLEND_FACTORS_IDS[C.BLEND_FACTORS[blendConfig[4]]]
                     , C.BLEND_FACTORS_IDS[C.BLEND_FACTORS[blendConfig[5]]]
                     ]
          }
          funcs.changeWGLBlend(index, newBlend);
          // blend.alphaEq[2] = BLEND_FACTORS_IDS[value];
          //return blend;
        });

      }
    }

    function addHtmlBlend(folder, config, layer, index) {
      const blendControl =
        folder.add(config, 'layer' + index + 'Blend', C.HTML_BLENDS).name('blend');
      blendControl.onFinishChange((value) => {
        funcs.changeHtmlBlend(index, value);
      });
    }

    function addLayerProps(folder, config, layer, index) {
      if (is.fss(layer)) {
        const mirrorSwitch = folder.add(config, 'mirror' + index).name('rorschach');
        const lightSpeed = folder.add(config, 'lightSpeed' + index).name('light pace')
                                 .min(100).max(2000);
        const facesX = folder.add(config, 'facesX' + index).name('columns').min(1).max(100).step(1);
        const facesY = folder.add(config, 'facesY' + index).name('rows').min(1).max(100).step(1);
        const fogFolder = folder.addFolder('fog');
        const vignette = fogFolder.add(config, 'vignette' + index).name('shine').min(0).max(1).step(0.01);
        const iris = fogFolder.add(config, 'iris' + index).name('density').min(0).max(1).step(0.01);
        const renderMode = folder.add(config, 'renderMode' + index, C.RENDER_MODES).name('structure');

        const amplitudeFolder = folder.addFolder('ranges');
        const amplitudeX = amplitudeFolder.add(config, 'amplitudeX' + index).name('horizontal')
          .min(0.0).max(1.0);
        const amplitudeY = amplitudeFolder.add(config, 'amplitudeY' + index).name('vertical')
          .min(0.0).max(1.0);
        const amplitudeZ = amplitudeFolder.add(config, 'amplitudeZ' + index).name('depth')
          .min(0.0).max(1.0);

        const opacity = folder.add(config, 'opacity' + index).name('opacity').min(0).max(1).step(0.01);

        const colorShiftFolder = folder.addFolder('coloring');
        const hue = colorShiftFolder.add(config, 'hue' + index).name('hue')
          .min(-1.0).max(1.0).step(0.01);
        const saturation = colorShiftFolder.add(config, 'saturation' + index).name('saturation')
          .min(-1.0).max(1.0).step(0.01);
        const brightness = colorShiftFolder.add(config, 'brightness' + index).name('brightness')
          .min(-1.0).max(1.0).step(0.01);

        mirrorSwitch.onFinishChange(val => switchMirror(index, val));
        lightSpeed.onFinishChange(funcs.changeLightSpeed(index));
        facesX.onFinishChange(funcs.changeFacesX(index));
        facesY.onFinishChange(funcs.changeFacesY(index));
        vignette.onFinishChange(funcs.changeVignette(index));
        iris.onFinishChange(funcs.changeIris(index));
        renderMode.onFinishChange(funcs.changeRenderMode(index));

        amplitudeX.onFinishChange(value => {
          funcs.changeAmplitude(index)(value, null, null);
        });
        amplitudeY.onFinishChange(value => {
          funcs.changeAmplitude(index)(null, value, null);
        });
        amplitudeZ.onFinishChange(value => {
          funcs.changeAmplitude(index)(null, null, value);
        });

        opacity.onFinishChange(funcs.changeOpacity(index));

        hue.onFinishChange(value => {
          funcs.shiftColor(index)(value, null, null);
        });
        saturation.onFinishChange(value => {
          funcs.shiftColor(index)(null, value, null);
        });
        brightness.onFinishChange(value => {
          funcs.shiftColor(index)(null, null, value);
        });
      }
      if (layer.visible != 'locked') {
        const visibitySwitch = folder.add(config, 'visible' + index).name('visible');
        visibitySwitch.onFinishChange(switchLayer(index));
      }

      const opacity = folder.add(config, 'opacity' + index).name('opacity').min(0.0).max(1).step(0.01);
      opacity.onFinishChange(funcs.changeOpacity(index));

      if (is.cover(layer)) {
        const productVisibilitySwitch =
          folder.add(config, 'productShown' + index).name('product');
        productVisibilitySwitch.onFinishChange(funcs.switchCoverProductVisibility(index));
      }
      if (is.fluid(layer) || is.nativeMetaballs(layer)) {
        folder.add(config, 'bang' + index).name('bang');
        if (is.fluid(layer)) {
          folder.add(config, 'rebuildGradients' + index).name('regenerate gradients');
        }
        const variety = folder.add(config, 'variety' + index).name('variety').min(0.01).max(1).step(0.01);
        const orbit = folder.add(config, 'orbit' + index).name('orbit').min(0).max(1).step(0.05);
        const blur = folder.add(config, 'blur' + index).name('myopia').min(0).max(1).step(0.01);
        const fat = folder.add(config, 'fat' + index).name('fat').min(0).max(1).step(0.01);
        const ring = folder.add(config, 'ring' + index).name('x-ray').min(0).max(1).step(0.01);
        variety.onFinishChange(
          is.fluid(layer)
            ? funcs.changeFluidVariety(index)
            : funcs.changeNativeMetaballsVariety(index));
        orbit.onFinishChange(
          is.fluid(layer)
            ? funcs.changeFluidOrbit(index)
            : funcs.changeNativeMetaballsOrbit(index));
        blur.onFinishChange(
            funcs.changeNativeMetaballsEffects(index, 'blur'));
        fat.onFinishChange(
            funcs.changeNativeMetaballsEffects(index, 'fat'));
        ring.onFinishChange(
            funcs.changeNativeMetaballsEffects(index, 'ring'));
      }
      if (is.background(layer)) {
        const stop1 = folder.add(config, 'stop1' + index).name('heaven');
        const stop2 = folder.add(config, 'stop2' + index).name('dragons');
        const stop3 = folder.add(config, 'stop3' + index).name('earth');
        const switchStop = funcs.switchBackgroundStop;
        stop1.onFinishChange(switchStop(index, 0));
        stop2.onFinishChange(switchStop(index, 1));
        stop3.onFinishChange(switchStop(index, 2));
        const gradientType = folder.add(config, 'isRadial' + index).name('radial');
        gradientType.onFinishChange(funcs.switchBackgroundGradientType(index));
      }
    }

    const gui = new dat.GUI(/*{ load: JSON }*/);
    const config = new Config(layers, defaults, constants, funcs,
        randomize(funcs.applyRandomizer, model, update(gui)));
    const product = gui.add(config, 'product', productToId);

    const sizePreset = gui.add(config, 'sizePreset', sizePresetSet).name('size');
    // gui.add(config, 'savePng').name('save png');
    if (mode !== 'prod') gui.add(config, 'saveBatch').name('save batch');
    gui.add(config, 'randomize').name('i feel lucky');
    product.onFinishChange(updateProduct);
    sizePreset.onFinishChange(funcs.resize);

    layers.forEach((layer, index) => {
      // if ((mode == 'prod') && (layer.name == 'Cover')) return;
      //console.log(layer);
      //const index = layers.length - 1 - revIndex;
      //const folder = gui.addFolder('Layer ' + index + ' (' + layer.kind + ')');
      const folder = gui.addFolder(layer.def.toLowerCase() + ' (' + index + ')');

      addLayerProps(folder, config, layer, index);
      if (layer.king == 'webgl') {
        addWebGLBlend(folder, config, layer, index);
      } else {
        if (!is.background(layer)) {
          addHtmlBlend(folder, config, layer, index);
        }
      }
    });

    let guiHidden = false;

    //update(gui);

    document.addEventListener('keydown', (event) => {
        if (event.keyCode == 32) {
            if (guiHidden) {
              document.querySelectorAll('.dg')[0].style.display = 'block';
              gui.open();
            } else {
              document.querySelectorAll('.dg')[0].style.display = 'none';
              gui.close();
            }
            guiHidden = !guiHidden;
        }
      });


    // const textBlend = gui.add(config, 'textBlend', HTML_BLENDS);
    // textBlend.onFinishChange((value) => {
    //   funcs.changeHtmlBlend(2, value);
    // });

    // const logoBlend = gui.add(config, 'logoBlend', HTML_BLENDS);
    // logoBlend.onFinishChange((value) => {
    //   funcs.changeHtmlBlend(3, value);
    // });


    //updateProduct('jetbrains');

    // layers.map((layer, index) => {
    //     gui.addFolder()
    // });

    return { config, update : update(gui) };
}

module.exports = start;
