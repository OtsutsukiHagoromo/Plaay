/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(globalThis["webpackChunkshopify_theme_starter"] = globalThis["webpackChunkshopify_theme_starter"] || []).push([["instafeed-slider"],{

/***/ "./src/js/modules/instafeed-slider.js":
/*!********************************************!*\
  !*** ./src/js/modules/instafeed-slider.js ***!
  \********************************************/
/***/ (() => {

eval("class InstafeedSlider extends HTMLElement {\r\n  constructor(){\r\n    super();\r\n    const buildInstagramFeed = (() => {\r\n      const elements = {\r\n        instagram_container: document.querySelector('.custom_instagram_slider')\r\n      };\r\n      const init = () => {\r\n        fetchFeed();\r\n      };\r\n      const fetchFeed = () => {\r\n        const instagram_post_limit = elements.instagram_container.dataset.limit;\r\n        fetch(`https://instafeed.nfcube.com/feed/v4?charge=0&fu=0&limit=${instagram_post_limit}&account=plaay-store.myshopify.com&fid=0&hash=99662ffd2fe86e30995b6a9f96aff872?locale=en`)\r\n        .then(response => response.json())\r\n        .then(data => {\r\n          if (data.meta.code !== 200) {\r\n            return\r\n          }\r\n          if (data && data.data && data.data.length) {\r\n            buildFeed(data.data)\r\n          }\r\n        })\r\n        .catch(err => console.error(err))\r\n      };\r\n      const buildFeed = (posts) => {\r\n        posts.forEach(post => {\r\n          const new_instagram_post = document.createElement('li');\r\n          buildSlideElement(new_instagram_post, post);\r\n          elements.instagram_container.appendChild(new_instagram_post);\r\n        });\r\n      };\r\n      const buildSlideElement = (element, data) => {\r\n        element.classList.add('insta_slide_element');\r\n        const link = document.createElement('a');\r\n        buildLink(link, data);\r\n        element.appendChild(link);\r\n      };\r\n      const buildImage = (element, data) => {\r\n        element.classList.add('insta_slide_image');\r\n        element.setAttribute('src', data.images.thumbnail.url);\r\n        element.setAttribute('loading', 'lazy');\r\n        element.setAttribute('alt', data.caption.text);\r\n      };\r\n      const buildLink = (element, data) => {\r\n        element.classList.add('insta_slide_link');\r\n        element.setAttribute('href', data.link);\r\n        element.setAttribute('target', '_blank');\r\n        const image = document.createElement('img');\r\n        buildImage(image, data);\r\n        element.appendChild(image);\r\n      };\r\n      return { init };\r\n    })();\r\n    buildInstagramFeed.init();\r\n  }\r\n};\r\ncustomElements.define('instafeed-slider', InstafeedSlider);\n\n//# sourceURL=webpack://shopify-theme-starter/./src/js/modules/instafeed-slider.js?");

/***/ })

}]);