/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["announcement-bar"],{

/***/ "./src/js/modules/announcement-bar.js":
/*!********************************************!*\
  !*** ./src/js/modules/announcement-bar.js ***!
  \********************************************/
/***/ (() => {

eval("class AnnouncementBar extends HTMLElement {\r\n  constructor(){\r\n    super();\r\n    const announcementBar = document.querySelector(\".announcement_bar_glide\");\r\n    if(announcementBar != null && announcementBar != undefined){\r\n      const announcementBarSlider = new Glide(announcementBar, {\r\n        type: 'carousel',\r\n        autoplay: announcementBar.dataset.autoplay\r\n      });\r\n      announcementBarSlider.mount();\r\n    }\r\n  }\r\n}\r\ncustomElements.define(\"announcement-bar\", AnnouncementBar); \n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/announcement-bar.js?");

/***/ })

}]);