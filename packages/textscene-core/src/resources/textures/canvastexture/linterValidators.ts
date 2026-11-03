/**
 * CanvasTexture property validation (`scene/main/canvas_item.cpp:1945-1955`). The three texture
 * setters refuse a CanvasTexture (`:1787,1801,1815`), which a reference check cannot see. No other
 * setter refuses a value, so each bound is the inspector hint's and warns.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import {
  CANVAS_ITEM_TEXTURE_FILTER_NAMES,
  CANVAS_ITEM_TEXTURE_REPEAT_NAMES,
} from '../../../godot/scene/canvasItem.js';

validatorRegistry.registerAll('CanvasTexture', {
  diffuse_texture: v.resourceReference('diffuse_texture'),
  normal_texture: v.resourceReference('normal_texture'),
  specular_texture: v.resourceReference('specular_texture'),
  specular_color: v.color('specular_color'),
  specular_shininess: v.float('specular_shininess', { min: 0, max: 1, hinted: 'canvas_item.cpp:1952' }),
  texture_filter: v.enumInt('texture_filter', CANVAS_ITEM_TEXTURE_FILTER_NAMES, {
    hinted: 'canvas_item.cpp:1954',
  }),
  texture_repeat: v.enumInt('texture_repeat', CANVAS_ITEM_TEXTURE_REPEAT_NAMES, {
    hinted: 'canvas_item.cpp:1955',
  }),
});
