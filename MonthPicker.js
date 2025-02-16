/*
https://github.com/KidSysco/jquery-ui-month-picker/

Version 2.8.1

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation;
version 3.0. This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public
License along with this library; if not, visit
http://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt.
*/
(function ($, window, document, Date) {
    'use strict';
    
    // This test must be run before any rererence is made to jQuery.
    // In case the user didn't load jQuery or jQuery UI the plugin
    // will fail before it get's to this test + there is no reason
    // to perform this test for every MonthPicker instance being created.
    if (!$ || !$.ui || !$.ui.button || !$.ui.datepicker) {
        alert(_setupErr + 'The jQuery UI button and datepicker plug-ins must be loaded.');
        return;
    }
    
    var _speeds = $.fx.speeds;
    var _eventsNs = '.MonthPicker';
    var _disabledClass = 'month-picker-disabled';
    var _todayClass = 'ui-state-highlight';
    var _selectedClass = 'ui-state-active';
    var _defaultPos = { my: 'left top+1', at: 'left bottom' };
    var _RTL_defaultPos = { my: 'right top+1', at: 'right bottom' };
    var _setupErr = 'MonthPicker Error: ';
    var _posErr = _setupErr + 'The jQuery UI position plug-in must be loaded.';
    var _badOptValErr = _setupErr + 'Unsupported % option value, supported values are: ';
    var _badMinMaxVal =  _setupErr + '"_" is not a valid %Month value.';
    var _openedInstance = null;
    var _hasPosition = !!$.ui.position;
    
    var _animVals = {
        Animation: ['slideToggle', 'fadeToggle', 'none'],
        ShowAnim: ['fadeIn', 'slideDown', 'none'],
        HideAnim: ['fadeOut', 'slideUp', 'none']
    };
    
    var _setOptionHooks = {
        ValidationErrorMessage: '_createValidationMessage',
        Disabled: '_setDisabledState', 
        ShowIcon: '_updateButton', 
        Button: '_updateButton',
        ShowOn: '_updateFieldEvents',
        IsRTL: '_setRTL',
        AltFormat: '_updateAlt',
        AltField: '_updateAlt',
        StartYear: '_setPickerYear',
        MinMonth: '_setMinMonth',
        MaxMonth: '_setMaxMonth',
        SelectedMonth: '_setSelectedMonth'
    };
    
    var $noop = $.noop;
    var $proxy = $.proxy;
    var $datepicker = $.datepicker;
    var click = 'click' + _eventsNs;
    
    function _toMonth(date) {
        return date.getMonth() + (date.getFullYear() * 12);
    }
    
    function _toYear(month) {
        return Math.floor(month / 12);
    }
    
    function _stayActive() {
        $(this).addClass(_selectedClass);
    }
    
    function _setActive( el, state ) {
        return el[ state ? 'on' : 'off' ]('mousenter mouseout',  _stayActive )
              .toggleClass(_selectedClass, state);
    }
    
    function _between(month, from, until) {
        return (!from || month >= from) && (!until || month <= until);
    }
    
    function _encodeMonth(_inst, _val) {
        if (_val === null) {
            return _val;
        } else if (_val instanceof Date) {
            return _toMonth(_val);
        } else if ($.isNumeric(_val)) {
            return _toMonth(new Date) + parseInt(_val, 10);
        }
        
        var _date = _inst._parseMonth(_val);
        if (_date) {
            return _toMonth(_date);
        }

        return _parsePeriod(_val);
    }
    
    function _event(_event, _inst) {
        return $proxy(_inst.options[_event] || $noop, _inst.element[0]);
    }
    
    function _parsePeriod(_val, _initDate) {
        // Parsing is done by replacing tokens in the value to form
        // a JSON object with it's keys and values reversed 
        // (example '+1y +2m' will turn into {"+1":"y","+2":"m"})
        // After that we just revers the keys and values.
        var _json = _val.trim();
        _json = _json.replace(/y/i, '":"y"');
        _json = _json.replace(/m/i, '":"m"');

        try {
            var _rev = JSON.parse( '{"' + _json.replace(/ /g, ',"') + '}' ), obj = {};
                
            for (var key in _rev) {
                obj[ _rev[key] ] = key;
            }
            
            var _month = _toMonth(new Date);
            _month += (parseInt(obj.m, 10) || 0);
            return _month + (parseInt(obj.y, 10) || 0) * 12;
        } catch (e) {
            return false;
        }
    }
    
    function _makeDefaultButton(options) {
        // this refers to the associated input field.
        return $('<span id="MonthPicker_Button_' + this.id + '" class="month-picker-open-button">' + options.i18n.buttonText + '</span>')
            .button({
                text: false,
                icons: {
                    // Defaults to 'ui-icon-calculator'.
                    primary: options.ButtonIcon
                }
            });
    }
    
    function _applyArrowButton($el, dir) {
        $el.button('option', {
            icons: {
                primary: 'ui-icon-circle-triangle-' + (dir ? 'w' : 'e')
            }
        });
    }
    
    function _isInline(elem) {
        return !elem.is('input');
    }
    
    $.MonthPicker = {
        VERSION: '2.8.1', // Added in version 2.4;
        
        i18n: {
            year: "Year",
            prevYear: "Previous Year",
            nextYear: "Next Year",
            next5Years: 'Jump Forward 5 Years',
            prev5Years: 'Jump Back 5 Years',
            nextLabel: "Next",
            prevLabel: "Prev",
            buttonText: "Open Month Chooser",
            jumpYears: "Jump Years",
            months: ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']
        }
    };
    
    var _markup =
        '<div class="ui-widget-header ui-helper-clearfix ui-corner-all">' +
            '<table class="month-picker-year-table" width="100%" border="0" cellspacing="1" cellpadding="2">' +
                '<tr>' +
                    '<td class="previous-year"><button /></td>' +
                    '<td class="year-container-all">' +
                        '<div id="year-container">' +
                            '<span class="year-title" />' +
                            '<span class="year" />' +
                        '</div>' +
                    '</td>' +
                    '<td class="next-year"><button /></td>' +
                '</tr>' +
            '</table>' +
        '</div>' +
        '<div class="ui-widget ui-widget-content ui-helper-clearfix ui-corner-all">' +
            '<table class="month-picker-month-table" width="100%" border="0" cellspacing="1" cellpadding="2" />' +
        '</div>';

    $.widget("KidSysco.MonthPicker", {

        /******* Properties *******/

        options: {
            i18n: {},
            IsRTL: false,
            Position: null,
            StartYear: null,
            ShowIcon: true,
            UseInputMask: false,
            ValidationErrorMessage: null,
            Disabled: false,
            MonthFormat: 'mm/yy', 
            Animation: 'fadeToggle',
            ShowAnim: null,
            HideAnim: null,
            ShowOn: null,
            MinMonth: null,
            MaxMonth: null,
            Duration: 'normal',
            Button: _makeDefaultButton,
            ButtonIcon: 'ui-icon-calculator'
        },

        _monthPickerButton: $(),
        
        _validationMessage: $(),
        
        _selectedBtn: $(),

        /******* jQuery UI Widget Factory Overrides ********/

        _destroy: function () {
            var _elem = this.element;
            if (jQuery.mask && this.options.UseInputMask) {
                _elem.unmask();
                
                if (!this.GetSelectedDate()) {
                    _elem.val('');
                }
            }

            _elem.removeClass('month-year-input').off(_eventsNs);

            $(document).off(_eventsNs + this.uuid);

            this._monthPickerMenu.remove();
            
            var _button = this._monthPickerButton.off(click);
            if (this._removeOldBtn) {
                _button.remove();
            }
            
            this._validationMessage.remove();
        },

        _setOption: function (key, value) {
            switch (key) {
                case 'i18n':
                    // Pass a clone i18n object to the this._super.
                    value = $.extend({}, value);
                    break;
                case 'Position':
                    if (!_hasPosition) {
                        alert(_posErr);
                        return;
                    }
                case 'MonthFormat':
                    var date = this.GetSelectedDate();
                    if (date) {
                        this.element.val( this.FormatMonth(date, value) );
                    }
                    break;
            }
            
            // Make sure the user passed in a valid Animation, ShowAnim and HideAnim options values.
            if (key in _animVals && _animVals[key].indexOf(value) === -1) {
                alert(_badOptValErr.replace(/%/, key) + _animVals[key]);
                return;
            }
            
            // In jQuery UI 1.8, manually invoke the _setOption method from the base widget.
            //$.Widget.prototype._setOption.apply(this, arguments);
            // In jQuery UI 1.9 and above, you use the _super method instead.
            this._super(key, value);
            
            _setOptionHooks[key] ? this[ _setOptionHooks[key] ](value) : 0;
        },

        _create: function () {
            var _el = this.element, _opts = this.options;
            // According to http://www.w3.org/TR/html-markup/input.html#input
            // An input element with no type attribute specified represents the same thing as an
            // input element with its type attribute set to "text".
            // TLDR:
            // http://www.w3.org/TR/html5/forms.html#the-input-element 
            // https://api.jquery.com/text-selector/
            if (!_el.is('input,div,span') || ['text', 'month', void 0].indexOf(_el.attr('type')) === -1) {
                var error = _setupErr + 'MonthPicker can only be called on text or month inputs.';
                // Call alert first so that IE<10 won't trip over console.log and swallow all errors.
                alert(error + ' \n\nSee (developer tools) for more details.');
                
                console.error(error + '\n Caused by:');
                console.log(_el[0]);
                return false;
            }

            if (!$.mask && _opts.UseInputMask) {
                alert(_setupErr + 'The UseInputMask option requires the Input Mask Plugin. Get it from digitalbush.com');
                return false;
            }
            
            if (_opts.Position !== null && !_hasPosition) {
                alert(_posErr);
                return false;
            }
            
            // Make sure the user passed in a valid Animation, ShowAnim and HideAnim options values.
            for (var opt in _animVals) {
                if (_opts[opt] !== null && _animVals[opt].indexOf(_opts[opt]) === -1) {
                    alert(_badOptValErr.replace(/%/, opt) + _animVals[opt]);
                    return false;
                }
            }
            
            this._isMonthInputType = _el.attr('type') === 'month';
            if (this._isMonthInputType) {
                this.options.MonthFormat = this.MonthInputFormat;
                _el.css('width', 'auto');
            }

            _el.addClass('month-year-input');

            var _menu = this._monthPickerMenu = $('<div id="MonthPicker_' + _el[0].id + '" class="month-picker ui-helper-clearfix"></div>');
            var isInline = _isInline(_el);
            
            $(_markup).appendTo(_menu);
            (_menu).appendTo( isInline ? _el : document.body );

            $('.year-title', _menu).text(this._i18n('year'));
            
            this._yearContainerAll = 
                $('.year-container-all', _menu)
                .attr('title', this._i18n('jumpYears'))
                .click($proxy(this._showYearsClickHandler, this));

            this._createValidationMessage();

            this._yearContainer = $('.year', _menu);
            
            this._prevButton = $('.previous-year button', _menu).button({ text: false });
            this._nextButton = $('.next-year button', _menu).button({ text: false });
            
            this._setRTL(_opts.IsRTL); //Assigns icons to the next/prev buttons.
            
            var _iconClass = '.ui-button-icon-primary';
            $(_iconClass, this._nextButton).text(this._i18n('nextLabel'));
            $(_iconClass, this._prevButton).text(this._i18n('prevLabel'));

            var $table = $('.month-picker-month-table', _menu);
            for (var i = 0; i < 12; i++) {
                var $tr = !(i % 3) ? $('<tr />').appendTo($table) : $tr;
                $tr.append('<td><button class="button-' + (i + 1) + '" /></td>');
            }
            
            this._buttons = $('button', $table).button();
            
            _menu.on(click, function (event) {
                return false;
            });

            // Checks and initailizes Min/MaxMonth properties 
            // (creates _setMinMonth and _setMaxMonth methods).
            var me = this, Month = 'Month';
            $.each(['Min', 'Max'], function(i, type) {
                me["_set" + type + Month] = function(val) {
                    if ((me['_' + type + Month] = _encodeMonth(me, val)) === false) {
                        alert(_badMinMaxVal.replace(/%/, type).replace(/_/, val));
                    }
                };
                
                me._setOption(type + Month, me.options[type + Month]);
            });
            
            var _selMonth = _opts.SelectedMonth;
            if (_selMonth !== void 0) {
                var month = _encodeMonth(this, _selMonth);
                _el.val( this._formatMonth(new Date( _toYear(month), month % 12, 1)) );
            }
            
            this._updateAlt();
            
            this._setUseInputMask();
            this._setDisabledState();
            this._updateFieldEvents();
            this.Destroy = this.destroy;
            
            if (isInline) {
                this.Open();
            } else {
               // Update the alt field if the user manually changes
               // the input field.
               _el.change($proxy(this._updateAlt, this));
            }
        },

        /****** Publicly Accessible API functions ******/
        
        GetSelectedDate: function () {
            return this._parseMonth();
        },
        
        GetSelectedYear: function () {
            var date = this.GetSelectedDate();
            return date ? date.getFullYear() : NaN;
        },

        GetSelectedMonth: function () {
            var date = this.GetSelectedDate();
            return date ? date.getMonth()+1 : NaN;
        },
        
        Validate: function() {
            var _date = this.GetSelectedDate();
            
            if (this.options.ValidationErrorMessage !== null && !this.options.Disabled) {
                this._validationMessage.toggle(!_date);
            }
            
            return _date;
        },
        
        GetSelectedMonthYear: function () {
            var date = this.Validate();
            return date ? (date.getMonth() + 1) + '/' + date.getFullYear() : null;
        },

        Disable: function () {
            this._setOption("Disabled", true);
        },

        Enable: function () {
            this._setOption("Disabled", false);
        },

        ClearAllCallbacks: function () {
            for (var _opt in this.options) {
                if (_opt.indexOf('On') === 0) {
                    this.options[_opt] = $noop;
                }
            }
        },

        Clear: function () {
            this.element.val('');
            this._validationMessage.hide();
        },
        
        Toggle: function (event) {
            return this._visible ? this.Close(event) : this.Open(event);
        },
        
        Open: function (event) {
            var _elem = this.element, _opts = this.options;
            if (!_opts.Disabled && !this._visible) {
                // Allow the user to prevent opening the menu.
                event = event || $.Event();
                if (_event('OnBeforeMenuOpen', this)(event) === false || event.isDefaultPrevented()) {
                    return false;
                }
                
                this._visible = true;
                this._ajustYear(_opts);

                var _menu = this._monthPickerMenu;
                this._showMonths();
                
                if (_isInline(_elem)) {
                    _menu.css('position', 'static').show();
                    _event('OnAfterMenuOpen', this)();
                } else {
                    // If there is an open menu close it first.
                    if (_openedInstance) {
                        _openedInstance.Close(event);
                    }
                    
                    _openedInstance = this;
                        
                    $(document).on(click + this.uuid, $proxy(this.Close, this))
                               .on('keydown' + _eventsNs + this.uuid, $proxy(this._keyDown, this));
                    
                    // Trun off validation so that clicking one of the months
                    // won't blur the input field and trogger vlaidation
                    // befroe the month was chosen (click event was triggered).
                    // It is turned back on when Hide() is called.
                    _elem.off('blur' + _eventsNs).focus();
                    
                    var _anim = _opts.ShowAnim || _opts.Animation,
                        _noAnim = _anim === 'none';
                    
                    // jQuery UI overrides jQuery.show and dosen't 
                    // call the start callback.
                    // see: http://api.jqueryui.com/show/
                    _menu[ _noAnim ? 'fadeIn' : _anim ]({
                       duration: _noAnim ? 0 : this._duration(),
                       start: $proxy(this._position, this, _menu),
                       complete: _event('OnAfterMenuOpen', this)
                    });
                }
            }
            
            return false;
        },
        
        Close: function (event) {            
            var _elem = this.element;
            if (!_isInline(_elem) && this._visible) {
                var _menu = this._monthPickerMenu, 
                    _opts = this.options;
                
                event = event || $.Event();
                if (_event('OnBeforeMenuClose', this)(event) === false || event.isDefaultPrevented()) {
                    return;
                }
                
                this._visible = false;
                _openedInstance = null;
                $(document).off('keydown' + _eventsNs + this.uuid)
                           .off(click + this.uuid);
                           
                this.Validate();
                _elem.on('blur' + _eventsNs, $proxy(this.Validate, this));
                var _callback = _event('OnAfterMenuClose', this);
                
                var _anim = _opts.HideAnim || _opts.Animation;
                if (_anim === 'none') {
                    _menu.hide(0, _callback);
                } else {
                    _menu[ _anim ](this._duration(), _callback);
                }
            }
        },
        
        /**
         * Methods the user can override to use a third party library
         * such as http://momentjs.com for parsing and formatting months.
         */
        MonthInputFormat: 'yy-mm',
         
        ParseMonth: function (str, format) {
            try {
                return $datepicker.parseDate('dd' + format, '01' + str);
            } catch (e) {
                return null;
            }
        },
        
        FormatMonth: function (date, format) {
            try {
                return $datepicker.formatDate(format, date) || null;
            } catch (e) {
                return null;
            }
        },
        
        /****** Private and Misc Utility functions ******/
        
        _setSelectedMonth: function (_selMonth) {            
            var month = _encodeMonth(this, _selMonth), _el = this.element;
        
            if (!month) {
                _el.val( '' );
            } else {
                _el.val( this._formatMonth( new Date( _toYear(month), month % 12, 1)) );
            }
            
            this._ajustYear(this.options);
            this._showMonths();
        },

        _i18n: function(str) {
            return this.options.i18n[str] || $.MonthPicker.i18n[str];
        },
        
        _parseMonth: function (str, format) {
            return this.ParseMonth(str || this.element.val(), format || this.options.MonthFormat);
        },
        
        _formatMonth: function (date, format) {
            return this.FormatMonth(date || this._parseMonth(), format || this.options.MonthFormat);
        },

        _updateButton: function () {
            var isDisabled = this.options.Disabled;
            
            this._createButton();
            
            // If the button is a jQuery UI button, 
            // plain HTML button or an input we support disable it,
            // otherwise the user must handle the diabled state
            // by creating an appropriate button by passing
            // a function. See Button option: Img tag tests for
            // more details.
            var _button = this._monthPickerButton;
            try {
                _button.button('option', 'disabled', isDisabled);
            } catch (e) {
                _button.filter('button,input').prop('disabled', isDisabled);
            }

            this._updateFieldEvents();
        },

        _createButton: function () {
            var _elem = this.element, _opts = this.options;
            if (_isInline(_elem)) return;
            
            var _oldButton = this._monthPickerButton.off(_eventsNs);
            var _btnOpt = _opts.ShowIcon ? _opts.Button : false;
            
            if ($.isFunction(_btnOpt)) {
                _btnOpt = _btnOpt.call(_elem[0], $.extend(true, {i18n: $.MonthPicker.i18n}, this.options));
            }
            
            var _removeOldBtn = false;
            this._monthPickerButton = ( _btnOpt instanceof $ ? _btnOpt : $(_btnOpt) )
                .each(function() {
                    if (!$.contains(document.body, this)) {
                        _removeOldBtn = true;
                        $(this).insertAfter(_elem);
                    }
                })
                .on(click, $proxy(this.Toggle, this));
            
            if (this._removeOldBtn) {
                _oldButton.remove();
            }
            
            this._removeOldBtn = _removeOldBtn;
        },

        _updateFieldEvents: function () {
            var _events = click + ' focus' + _eventsNs;
            this.element.off(_events);
            if (this.options.ShowOn === 'both' || !this._monthPickerButton.length) {
                this.element.on(_events, $proxy(this.Open, this));
            }
        },

        _createValidationMessage: function () {
            var _errMsg = this.options.ValidationErrorMessage, _elem = this.element;
            if ([null, ''].indexOf(_errMsg) === -1) {
                var _msgEl = $('<span id="MonthPicker_Validation_' + _elem[0].id + '" class="month-picker-invalid-message">' + _errMsg + '</span>');

                var _button = this._monthPickerButton;
                this._validationMessage = _msgEl.insertAfter(_button.length ? _button : _elem);
                
                _elem.on('blur' + _eventsNs, $proxy(this.Validate, this));
            } else {
                this._validationMessage.remove();
            }
        },
        
        _setRTL: function(value) {
            _applyArrowButton(this._prevButton, !value);
            _applyArrowButton(this._nextButton, value);
        },
        
        _keyDown: function (event) {
            // Don't use $.ui.keyCode to help minification.
            switch (event.keyCode) {
                case 13: // Enter.
                    this._chooseMonth(new Date().getMonth() + 1);
                    this.Close(event);
                    break;
                case 27: // Escape
                case 9: // Tab
                    this.Close(event);
                    break;
            }
        },
        
        _duration: function() {
            var _dur = this.options.Duration;

            if ($.isNumeric(_dur)) {
                return _dur;
            }

            return _dur in _speeds ? _speeds[ _dur ] : _speeds._default;
        },
        
        _position: _hasPosition ?
            function($menu) {
                var _defauts = this.options.IsRTL ? _RTL_defaultPos : _defaultPos;
                var _posOpts = $.extend(_defauts, this.options.Position);
                
                return $menu.position($.extend({of: this.element}, _posOpts));
            } :
            function($menu) {
                var _el = this.element, 
                    _css = { top: (_el.offset().top + _el.height() + 7) + 'px' };

                if (this.options.IsRTL) {
                    _css.left = (_el.offset().left-$menu.width()+_el.width() + 7) + 'px';
                } else {
                    _css.left = _el.offset().left + 'px';
                }
                
                return $menu.css(_css);
            },
                    
        _setUseInputMask: function () {
            if (!this._isMonthInputType) {
                try {
                    if (this.options.UseInputMask) {   
                        this.element.mask( this._formatMonth(new Date).replace(/\d/g, 9) );
                    } else {
                        this.element.unmask();
                    }
                } catch (e) {}
            }
        },

        _setDisabledState: function () {
            var isDisabled = this.options.Disabled, _elem = this.element;
            
            // Disable the associated input field.
            _elem[0].disabled = isDisabled;
            _elem.toggleClass(_disabledClass, isDisabled);
            
            if (isDisabled) {
                this._validationMessage.hide();
            }
            
            this.Close();
            this._updateButton();

            _event('OnAfterSetDisabled', this)(isDisabled);
        },
        
        _getPickerYear: function () {
            return parseInt(this._yearContainer.text(), 10);
        },

        _setPickerYear: function (year) {
            this._yearContainer.text(year || new Date().getFullYear());
        },

        _updateAlt: function (noop, date) {
            // False means use the fields value.
            var _field = $(this.options.AltField);
            if (_field.length) {
                _field.val(this._formatMonth(date, this.options.AltFormat));
            }
        },
        
        _chooseMonth: function (month) {
            var date = new Date(this._getPickerYear(), month-1);
            this.element.val(this._formatMonth( date )).blur();
            this._updateAlt(0, date);
            
            _setActive( this._selectedBtn, false );
            this._selectedBtn = _setActive( $(this._buttons[month-1]), true );
            
            _event('OnAfterChooseMonth', this)(date);
        },

        _chooseYear: function (year) {
            this._setPickerYear(year);
            this._buttons.removeClass(_todayClass);
            this._showMonths();

            _event('OnAfterChooseYear', this)();
        },

        _showMonths: function () {
            var _months = this._i18n('months');
            
            this._prevButton
                .attr('title', this._i18n('prevYear'))
                .off(click)
                .on(click, $proxy(this._addToYear, this, -1));

            this._nextButton
                .attr('title', this._i18n('nextYear'))
                .off(click)
                .on(click, $proxy(this._addToYear, this, 1));

            this._yearContainerAll.css('cursor', 'pointer');
            
            this._buttons.off(_eventsNs);

            var me = this, _onMonthClick = $proxy(me._onMonthClick, me);
            $.each(_months, function(index, monthName) {
                $(me._buttons[index])
                    .on(click, {month: index+1}, _onMonthClick )
                    .button('option', 'label', monthName);
            });
            
            this._decorateButtons();
        },

        _showYearsClickHandler: function () {
            this._buttons.removeClass(_todayClass);
            this._showYears();

            _event('OnAfterChooseYears', this)();
        },

        _showYears: function () {
            var _currYear = this._getPickerYear(),
                _yearDifferential = -4,
                _firstYear = (_currYear + _yearDifferential),
                AMOUNT_TO_ADD = 5,
                _thisYear = new Date().getFullYear();
                        
            var _minDate = this._MinMonth;
            var _maxDate = this._MaxMonth;
            var _minYear = _minDate ? _toYear(_minDate) : 0;
            var _maxYear = _maxDate ? _toYear(_maxDate) : 0;
            this._prevButton
                .attr('title', this._i18n('prev5Years'))
                .off(click)
                .on(click, $proxy(this._addToYears, this, -AMOUNT_TO_ADD))
                .button('option', 'disabled', _minYear && (_firstYear - 1) < _minYear);

            this._nextButton
                .attr('title', this._i18n('next5Years'))
                .off(click)
                .on(click, $proxy(this._addToYears, this, AMOUNT_TO_ADD))
                .button('option', 'disabled', _maxYear && (_firstYear + 12) -1 > _maxYear);

            this._yearContainerAll.css('cursor', 'default');
            this._buttons.off(_eventsNs);

            _setActive( this._selectedBtn, false );
            
            var _selYear = this.GetSelectedYear();
            var _onClick = $proxy(this._onYearClick, this);
            var _todayWithinBounds = _between(_thisYear, _minYear, _maxYear);
            var _selWithinBounds = _between(_selYear, _minYear, _maxYear);
            
            for (var _counter = 0; _counter < 12; _counter++) {
                var _year = _currYear + _yearDifferential;
                
                var _btn = $( this._buttons[_counter] ).button({
                        disabled: !_between(_year, _minYear, _maxYear),
                        label: _year
                    })
                    .toggleClass(_todayClass, _year === _thisYear && _todayWithinBounds) // Heighlight the current year.
                    .on(click, { year: _year }, _onClick )
                    
                 // Heighlight the selected year.
                if (_selWithinBounds && _selYear && _selYear === _year) {
                    this._selectedBtn = _setActive( _btn , true );
                }
                
                _yearDifferential++;
            }
        },
        
        _onMonthClick: function(event) {
            this._chooseMonth(event.data.month);
            this.Close(event);
        },
        
        _onYearClick: function(event) {
            this._chooseYear(event.data.year);
        },
        
        _addToYear: function(amount) {
            var _year = this._yearContainer;
            _year.text(parseInt(_year.text()) + amount, 10);
            this.element.focus();
            
            this._decorateButtons();
            
            _event('OnAfter' + (amount > 0 ? 'Next' : 'Previous') + 'Year', this)();
        },

        _addToYears: function(amount) {
            var _year = this._yearContainer;
            _year.text(parseInt(_year.text()) + amount, 10);
            this._showYears();
            this.element.focus();

            _event('OnAfter' + (amount > 0 ? 'Next' : 'Previous') + 'Years', this)();
        },
        
        _ajustYear: function(_opts) {
            var _year = _opts.StartYear || this.GetSelectedYear() || new Date().getFullYear();
            if (this._MinMonth !== null) {
                _year = Math.max(_toYear(this._MinMonth), _year);
            }
            if (this._MaxMonth !== null) {
                _year = Math.min(_toYear(this._MaxMonth), _year);
            }
            
            this._setPickerYear( _year );
        },
        
        _decorateButtons: function() {
            var _curYear = this._getPickerYear(), _todaysMonth = _toMonth(new Date),
                _minDate = this._MinMonth, _maxDate = this._MaxMonth;
            
            // Heighlight the selected month.
            _setActive( this._selectedBtn, false );
            var _sel = this.GetSelectedDate();
            var _withinBounds = _between(_sel ? _toMonth(_sel) : null, _minDate, _maxDate);
                
            if (_sel && _sel.getFullYear() === _curYear) {
                this._selectedBtn = _setActive( $(this._buttons[_sel.getMonth()]) , _withinBounds );
            }   
            
            // Disable the next/prev button if we've reached the min/max year.
            this._prevButton.button('option', 'disabled', _minDate && _curYear == _toYear(_minDate));
            this._nextButton.button('option', 'disabled', _maxDate && _curYear == _toYear(_maxDate));
            
            for (var i = 0; i < 12; i++) {
                // Disable the button if the month is not between the 
                // min and max interval.
                var _month = (_curYear * 12) + i, _isBetween = _between(_month, _minDate, _maxDate);
                
                $(this._buttons[i])
                    .button({ disabled: !_isBetween })
                    .toggleClass(_todayClass, _isBetween && _month == _todaysMonth); // Highlights today's month.
            }
        }
    });
}(jQuery, window, document, Date));
