/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["contact-faqs"],{

/***/ "./src/js/modules/contact-faqs.js":
/*!****************************************!*\
  !*** ./src/js/modules/contact-faqs.js ***!
  \****************************************/
/***/ (() => {

eval("class ContactFaqs extends HTMLElement {\r\n  constructor(){\r\n    super();\r\n\r\n    const faqsToggle = (() => {\r\n      const elements = {\r\n        faqSelectToggle: document.querySelector('.faq_select_toggle'),\r\n        faqCategorySections: document.querySelectorAll('.faq_category_section'),\r\n        faqDesktopCategories: document.querySelectorAll(\"[data-desktop-category]\")\r\n      };\r\n      const toggleFaqSection = (selectedOption) => {\r\n        elements.faqCategorySections.forEach(section => {\r\n          section.classList.remove('.max-h-[60rem]');\r\n          if(section.dataset.category === selectedOption.toLowerCase()){\r\n            section.querySelector('.inner_container').classList.add('max-h-[60rem]');\r\n            section.querySelector('.inner_container').classList.remove('max-h-0');\r\n          } else {\r\n            section.querySelector('.inner_container').classList.remove('max-h-[60rem]');\r\n            section.querySelector('.inner_container').classList.add('max-h-0');\r\n          }\r\n        });\r\n      };\r\n      const eventListeners = () => {\r\n        elements.faqSelectToggle.addEventListener('change', () => {\r\n          toggleFaqSection(elements.faqSelectToggle.value);\r\n        });\r\n        elements.faqDesktopCategories.forEach(category => {\r\n          category.addEventListener('click', () => {\r\n            elements.faqDesktopCategories.forEach(category => {\r\n              category.classList.remove('active');\r\n            }, 200);\r\n            setTimeout(() => {\r\n              category.classList.add('active');\r\n            }, 200);\r\n            toggleFaqSection(category.dataset.title);\r\n          });\r\n        });\r\n      };\r\n      const init = () => {\r\n        eventListeners();\r\n      };\r\n      return { init };\r\n    })();\r\n    faqsToggle.init();\r\n  }\r\n}\r\ncustomElements.define('contact-faqs', ContactFaqs);\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/contact-faqs.js?");

/***/ })

}]);