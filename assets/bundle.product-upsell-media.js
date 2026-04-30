/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["product-upsell-media"],{

/***/ "./src/js/modules/product-upsell-media.js":
/*!************************************************!*\
  !*** ./src/js/modules/product-upsell-media.js ***!
  \************************************************/
/***/ (() => {

eval("class ProductUpsellMedia extends HTMLElement {\r\n  constructor(){\r\n    super();\r\n\r\n    this.initialiseSlider();\r\n  }\r\n\r\n  initialiseSlider () {\r\n\r\n    setTimeout(() => {\r\n      const upsellMediaFlide = document.querySelectorAll('.upsell_media_glide');\r\n\r\n      if(upsellMediaFlide !== null && upsellMediaFlide !== undefined){\r\n        upsellMediaFlide.forEach(slider => {\r\n          const upsellGlide = new Glide(slider, {\r\n            type: 'carousel',\r\n            autoplay: parseInt(slider.dataset.autoplay)\r\n          });\r\n          upsellGlide.mount();\r\n        });\r\n      };\r\n    }, 650);\r\n\r\n  }\r\n}\r\ncustomElements.define('product-upsell-media', ProductUpsellMedia);\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/product-upsell-media.js?");

/***/ })

}]);