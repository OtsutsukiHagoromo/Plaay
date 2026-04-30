/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["drawers"],{

/***/ "./src/js/modules/drawers.js":
/*!***********************************!*\
  !*** ./src/js/modules/drawers.js ***!
  \***********************************/
/***/ (() => {

eval("class Drawers extends HTMLElement {\r\n  constructor() {\r\n    super();\r\n\r\n    this._activeDrawer = false;\r\n\r\n    this.overlay = this.querySelector('[data-overlay]');\r\n    this.triggers = document.querySelectorAll('[data-drawer-trigger]');\r\n\r\n    this.setupTriggers();\r\n  }\r\n\r\n  setupTriggers() {\r\n    this.triggers.forEach((trigger) => {\r\n      trigger.addEventListener('click', () => {\r\n        if (\r\n          document.body.classList.contains('template-cart') &&\r\n          trigger.dataset.drawerTrigger === 'cart'\r\n        ) {\r\n          return;\r\n        }\r\n\r\n        this.activeDrawer = trigger.dataset.drawerTrigger;\r\n      });\r\n    });\r\n  }\r\n\r\n  handleEscapeClick(e) {\r\n    if (e.key === 'Escape') {\r\n      this.close();\r\n    }\r\n  }\r\n\r\n  close() {\r\n    this.activeDrawer = false;\r\n  }\r\n\r\n  get activeDrawer() {\r\n    return this._activeDrawer;\r\n  }\r\n\r\n  set activeDrawer(val) {\r\n    /**\r\n     * Close previous drawer\r\n     */\r\n    this.querySelector(`[data-drawer=\"${this.activeDrawer}\"]`) &&\r\n      this.querySelector(`[data-drawer=\"${this.activeDrawer}\"]`).close();\r\n\r\n    /**\r\n     * Event listeners\r\n     */\r\n    if (val && !this.activeDrawer) {\r\n      document.body.classList.add('overflow-hidden');\r\n      document.addEventListener('keydown', this.handleEscapeClick.bind(this));\r\n\r\n      this.overlay.classList.add('active');\r\n      this.overlay.addEventListener('click', this.close.bind(this));\r\n    } else if (!val) {\r\n      document.body.classList.remove('overflow-hidden');\r\n      document.removeEventListener('keydown', this.handleEscapeClick.bind(this));\r\n\r\n      this.overlay.classList.remove('active');\r\n      this.overlay.removeEventListener('click', this.close.bind(this));\r\n    }\r\n\r\n    /**\r\n     * Open new drawer\r\n     */\r\n    if (val) {\r\n      const newDrawer = this.querySelector(`[data-drawer=\"${val}\"]`);\r\n\r\n      if (this.activeDrawer) {\r\n        newDrawer.querySelector('[data-drawer]').classList.add('delay-300');\r\n\r\n        newDrawer.querySelector('[data-drawer]').addEventListener(\r\n          'transitionend',\r\n          () => {\r\n            newDrawer.querySelector('[data-drawer]').classList.remove('delay-300');\r\n          },\r\n          { once: true }\r\n        );\r\n      }\r\n\r\n      newDrawer.open();\r\n    }\r\n\r\n    this._activeDrawer = val;\r\n  }\r\n}\r\n\r\ncustomElements.define('site-drawers', Drawers);\r\n\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/drawers.js?");

/***/ })

}]);