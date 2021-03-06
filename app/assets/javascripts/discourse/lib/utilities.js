/**
  General utility functions

  @class Utilities
  @namespace Discourse
  @module Discourse
**/
Discourse.Utilities = {

  translateSize: function(size) {
    switch (size) {
      case 'tiny': return 20;
      case 'small': return 25;
      case 'medium': return 32;
      case 'large': return 45;
      case 'extra_large': return 60;
      case 'huge': return 120;
    }
    return size;
  },

  /**
    Allows us to supply bindings without "binding" to a helper.
  **/
  normalizeHash: function(hash, hashTypes) {
    for (var prop in hash) {
      if (hashTypes[prop] === 'ID') {
        hash[prop + 'Binding'] = hash[prop];
        delete hash[prop];
      }
    }
  },

  avatarUrl: function(template, size) {
    if (!template) { return ""; }
    var rawSize = Discourse.Utilities.getRawSize(Discourse.Utilities.translateSize(size));
    return template.replace(/\{size\}/g, rawSize);
  },

  getRawSize: function(size) {
    var pixelRatio = window.devicePixelRatio || 1;
    return pixelRatio >= 1.5 ? size * 2 : size;
  },

  avatarImg: function(options) {
    var size = Discourse.Utilities.translateSize(options.size);
    var url = Discourse.Utilities.avatarUrl(options.avatarTemplate, size);

    // We won't render an invalid url
    if (!url || url.length === 0) { return ""; }

    var classes = "avatar" + (options.extraClasses ? " " + options.extraClasses : "");
    var title = (options.title) ? " title='" + Handlebars.Utils.escapeExpression(options.title || "") + "'" : "";
    return "<img width='" + size + "' height='" + size + "' src='" + url + "' class='" + classes + "'" + title + ">";
  },

  tinyAvatar: function(avatarTemplate, options) {
    return Discourse.Utilities.avatarImg(_.merge({avatarTemplate: avatarTemplate, size: 'tiny' }, options));
  },

  postUrl: function(slug, topicId, postNumber) {
    var url = Discourse.getURL("/t/");
    if (slug) {
      url += slug + "/";
    } else {
      url += 'topic/';
    }
    url += topicId;
    if (postNumber > 1) {
      url += "/" + postNumber;
    }
    return url;
  },

  userUrl: function(username) {
    return Discourse.getURL("/users/" + username.toLowerCase());
  },

  emailValid: function(email) {
    // see:  http://stackoverflow.com/questions/46155/validate-email-address-in-javascript
    var re = /^[a-zA-Z0-9!#$%&'*+\/=?\^_`{|}~\-]+(?:\.[a-zA-Z0-9!#$%&'\*+\/=?\^_`{|}~\-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?$/;
    return re.test(email);
  },

  selectedText: function() {
    var html = '';

    if (typeof window.getSelection !== "undefined") {
      var sel = window.getSelection();
      if (sel.rangeCount) {
        var container = document.createElement("div");
        for (var i = 0, len = sel.rangeCount; i < len; ++i) {
          container.appendChild(sel.getRangeAt(i).cloneContents());
        }
        html = container.innerHTML;
      }
    } else if (typeof document.selection !== "undefined") {
      if (document.selection.type === "Text") {
        html = document.selection.createRange().htmlText;
      }
    }

    // Strip out any .click elements from the HTML before converting it to text
    var div = document.createElement('div');
    div.innerHTML = html;
    $('.clicks', $(div)).remove();
    var text = div.textContent || div.innerText || "";

    return String(text).trim();
  },

  // Determine the position of the caret in an element
  caretPosition: function(el) {
    var r, rc, re;
    if (el.selectionStart) {
      return el.selectionStart;
    }
    if (document.selection) {
      el.focus();
      r = document.selection.createRange();
      if (!r) return 0;

      re = el.createTextRange();
      rc = re.duplicate();
      re.moveToBookmark(r.getBookmark());
      rc.setEndPoint('EndToStart', re);
      return rc.text.length;
    }
    return 0;
  },

  // Set the caret's position
  setCaretPosition: function(ctrl, pos) {
    var range;
    if (ctrl.setSelectionRange) {
      ctrl.focus();
      ctrl.setSelectionRange(pos, pos);
      return;
    }
    if (ctrl.createTextRange) {
      range = ctrl.createTextRange();
      range.collapse(true);
      range.moveEnd('character', pos);
      range.moveStart('character', pos);
      return range.select();
    }
  },

  validateUploadedFiles: function(files, bypassNewUserRestriction) {
    if (!files || files.length === 0) { return false; }

    if (files.length > 1) {
      bootbox.alert(I18n.t('post.errors.too_many_uploads'));
      return false;
    }

    var upload = files[0];

    // CHROME ONLY: if the image was pasted, sets its name to a default one
    if (typeof Blob !== "undefined" && typeof File !== "undefined") {
      if (upload instanceof Blob && !(upload instanceof File) && upload.type === "image/png") { upload.name = "blob.png"; }
    }

    var type = Discourse.Utilities.isAnImage(upload.name) ? 'image' : 'attachment';

    return Discourse.Utilities.validateUploadedFile(upload, type, bypassNewUserRestriction);
  },

  validateUploadedFile: function(file, type, bypassNewUserRestriction) {
    // check that the uploaded file is authorized
    if (!Discourse.Utilities.authorizesAllExtensions() &&
        !Discourse.Utilities.isAuthorizedUpload(file)) {
      var extensions = Discourse.Utilities.authorizedExtensions();
      bootbox.alert(I18n.t('post.errors.upload_not_authorized', { authorized_extensions: extensions }));
      return false;
    }

    if (!bypassNewUserRestriction) {
      // ensures that new users can upload a file
      if (!Discourse.User.current().isAllowedToUploadAFile(type)) {
        bootbox.alert(I18n.t('post.errors.' + type + '_upload_not_allowed_for_new_user'));
        return false;
      }
    }

    // check file size
    var fileSizeKB = file.size / 1024;
    var maxSizeKB = Discourse.SiteSettings['max_' + type + '_size_kb'];
    if (fileSizeKB > maxSizeKB) {
      bootbox.alert(I18n.t('post.errors.file_too_large', { max_size_kb: maxSizeKB }));
      return false;
    }

    // everything went fine
    return true;
  },


  /**
    Determine whether all file extensions are authorized.

    @method authorizesAllExtensions
  **/
  authorizesAllExtensions: function() {
    return Discourse.SiteSettings.authorized_extensions.indexOf("*") >= 0;
  },

  /**
    Check the extension of the file against the list of authorized extensions

    @method isAuthorizedUpload
    @param {File} file The file we want to upload
  **/
  isAuthorizedUpload: function(file) {
    if (file && file.name) {
      var extensions = _.chain(Discourse.SiteSettings.authorized_extensions.split("|"))
                        .reject(function(extension) { return extension.indexOf("*") >= 0; })
                        .map(function(extension) { return (extension.indexOf(".") === 0 ? extension.substring(1) : extension).replace(".", "\\."); })
                        .value();
      return new RegExp("\\.(" + extensions.join("|") + ")$", "i").test(file.name);
    }
    return false;
  },

  /**
    List the authorized extension for display

    @method authorizedExtensions
  **/
  authorizedExtensions: function() {
    return _.chain(Discourse.SiteSettings.authorized_extensions.split("|"))
            .reject(function(extension) { return extension.indexOf("*") >= 0; })
            .map(function(extension) { return extension.toLowerCase(); })
            .value()
            .join(", ");
  },

  /**
    Get the markdown template for an upload (either an image or an attachment)

    @method getUploadMarkdown
    @param {Upload} upload The upload we want the markdown from
  **/
  getUploadMarkdown: function(upload) {
    if (Discourse.Utilities.isAnImage(upload.original_filename)) {
      return '<img src="' + upload.url + '" width="' + upload.width + '" height="' + upload.height + '">';
    } else {
      return '<a class="attachment" href="' + upload.url + '">' + upload.original_filename + '</a> (' + I18n.toHumanSize(upload.filesize) + ')';
    }
  },

  /**
    Check whether the path is refering to an image

    @method isAnImage
    @param {String} path The path
  **/
  isAnImage: function(path) {
    return (/\.(png|jpg|jpeg|gif|bmp|tif|tiff|svg|webp)$/i).test(path);
  },

  /**
    Determines whether we allow attachments or not

    @method allowsAttachments
  **/
  allowsAttachments: function() {
    return Discourse.Utilities.authorizesAllExtensions() ||
           !(/((png|jpg|jpeg|gif|bmp|tif|tiff|svg|webp)(,\s)?)+$/i).test(Discourse.Utilities.authorizedExtensions());
  },

  displayErrorForUpload: function(data) {
    // deal with meaningful errors first
    if (data.jqXHR) {
      switch (data.jqXHR.status) {
        // cancelled by the user
        case 0: return;

        // entity too large, usually returned from the web server
        case 413:
          var maxSizeKB = Discourse.SiteSettings.max_image_size_kb;
          bootbox.alert(I18n.t('post.errors.file_too_large', { max_size_kb: maxSizeKB }));
          return;

        // the error message is provided by the server
        case 422:
          if (data.jqXHR.responseJSON.message) {
            bootbox.alert(data.jqXHR.responseJSON.message);
          } else {
            bootbox.alert(data.jqXHR.responseJSON.join("\n"));
          }
          return;
      }
    }
    // otherwise, display a generic error message
    bootbox.alert(I18n.t('post.errors.upload'));
  },

  /**
    Crop an image to be used as avatar.
    Simulate the "centered square thumbnail" generation done server-side.
    Uses only the first frame of animated gifs when they are disabled.

    @method cropAvatar
    @param {String} url The url of the avatar
    @param {String} fileType The file type of the uploaded file
    @returns {Promise} a promise that will eventually be the cropped avatar.
  **/
  cropAvatar: function(url, fileType) {
    if (Discourse.SiteSettings.allow_animated_avatars && fileType === "image/gif") {
      // can't crop animated gifs... let the browser stretch the gif
      return Ember.RSVP.resolve(url);
    } else {
      return new Ember.RSVP.Promise(function(resolve) {
        var image = document.createElement("img");
        // this event will be fired as soon as the image is loaded
        image.onload = function(e) {
          var img = e.target;
          // computes the dimension & position (x, y) of the largest square we can fit in the image
          var width = img.width, height = img.height, dimension, center, x, y;
          if (width <= height) {
            dimension = width;
            center = height / 2;
            x = 0;
            y = center - (dimension / 2);
          } else {
            dimension = height;
            center = width / 2;
            x = center - (dimension / 2);
            y = 0;
          }
          // set the size of the canvas to the maximum available size for avatars (browser will take care of downsizing the image)
          var canvas = document.createElement("canvas");
          var size = Discourse.Utilities.getRawSize(Discourse.Utilities.translateSize("huge"));
          canvas.height = canvas.width = size;
          // draw the image into the canvas
          canvas.getContext("2d").drawImage(img, x, y, dimension, dimension, 0, 0, size, size);
          // retrieve the image from the canvas
          resolve(canvas.toDataURL(fileType));
        };
        // launch the onload event
        image.src = url;
      });
    }
  },

  defaultHomepage: function() {
    // the homepage is the first item of the 'top_menu' site setting
    return Discourse.SiteSettings.top_menu.split("|")[0].split(",")[0];
  }

};
