// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.sections = {
	'_default': {
		'text': "<div style=\"font-family: Times New Roman; font-size: 3em; text-align:center; background-color: Black; color: White\"> \n<b>How to Get What You Want</b> \n</div>\n\n<hr>\n<p><i>Hello, and welcome to today&#39;s lesson, &quot;How to Get What You Want&quot;. </p>\n<p>In this game, you will be given a scenario and you must respond as if it were real. Think of how you would actually react to the situation presented to you.</p>\n<p>This lesson is designed to show you who you are in your response to others and how this affects you getting what you want out of your life. </p>\n<p>The goal is to end with a positive number in your <b>Effectiveness Score</b>. Good luck.</p>\n<p>I will first start by asking you what you want from life.</i></p>\n<hr>\n<p><a class=\"squiffy-link link-section\" data-section=\"Success Happiness and Purpose\" role=\"link\" tabindex=\"0\">Success Happiness and Purpose</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Nothing\" role=\"link\" tabindex=\"0\">Nothing</a></p>",
		'passages': {
			'Nothing': {
				'text': "<p><i>Got it all figured out huh? I doubt it. </p>\n<p>That was a test and clearly you failed.</p>\n<hr>\n<p><b>Scroll back up and pick the only real choice.</b></i></p>",
			},
		},
	},
	'Success Happiness and Purpose': {
		'clear': true,
		'text': "<p><i>Success, happiness, and purpose? Quite the tall order. Let&#39;s see if we can make that happen...</p>\n<p>Remember, you want to end with a positive <b>Effectiveness Score</b>.</i></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Begin\" role=\"link\" tabindex=\"0\">Begin</a></p>",
		'passages': {
		},
	},
	'Begin': {
		'clear': true,
		'text': "<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>Some say that money is power. They claim it breeds success and purchases happiness. </p>\n<p>Although, I am not certain that money is the answer to happiness, you only make a modest sum of money at the moment and it definetly isn&#39;t making you happy. </p>\n<p>Your job makes you feel powerless, unsuccessful, and, ultimately, unfulfilled. </p>\n<p>You went to college, worked hard, got a degree and even found a job at a huge corporation with very high finacial ceilings. </p>\n<p>You were so creative and driven to succeed once upon a time. </p>\n<p>But, you have worked here for years and have nothing to show for it. </p>\n<p>Same dead end position you started at with hardly a raise to show for it. Even now, you are exploding with new ideas to help your company (and yourself) make more money. </p>\n<p>However, your boss is usually too busy to talk to you or respond to your emails. </p>\n<p>You feel unappreciated and lack direction in your life.</p>\n<hr>\n<p>What are you going to do about it?</i></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Keep my head down. nothing good can come from being too pushy with my boss.\" role=\"link\" tabindex=\"0\">Keep my head down. nothing good can come from being too pushy with my boss.</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Barge into my boss's office and demand to speak with him. I've waited long enough.\" role=\"link\" tabindex=\"0\">Barge into my boss&#39;s office and demand to speak with him. I&#39;ve waited long enough.</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"I need to take action. I will go knock on my boss's door and ask him if he has a moment to talk.\" role=\"link\" tabindex=\"0\">I need to take action. I will go knock on my boss&#39;s door and ask him if he has a moment to talk.</a></p>",
		'attributes': ["score = 0"],
		'passages': {
			'Keep my head down. nothing good can come from being too pushy with my boss.': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took a <b>PASSIVE</b> path. You decided to just keep your head down and do your job. While this path may allow you to keep your job, you will not grow in the way you are seeking.</p>\n<p>People who act passively often end up feeling taken advantage of. They may begin to feel hurt, angry, or resentful. This path does not often lead to success, happiness, or any other desirable outcome.</p>\n<p>When you hold back what you think and feel, others don&#39;t get to know or understand you as well as they could. The people around you can never benefit from your input or ideas if you act passively.</p>\n<p>If you start to feel like your opinions or feelings don&#39;t count, it can lower your confidence and rob you of the chance to get recognition and positive feedback for your good ideas. This can even lead to feeling depressed.</i></p>\n<hr>\n<p><b>Scroll back up and try again.</b></p>",
				'attributes': ["score-=1"],
			},
			'Barge into my boss\'s office and demand to speak with him. I\'ve waited long enough.': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took an <b>AGGRESSIVE</b> path. You decided to barge into your boss&#39;s office and demand a conversation. Upon swinging open the door and greeting your boss with an angry, demanding look, you notice he was not alone. The owner of your corporation is sitting across the table from your boss with a very puzzled, yet unnamused look on his face.</i></p>\n<hr>\n<p>&quot;Is this the type of buisness you are running down here? Employees just barge through the doors in fits of rage? I knew this branch has been less productive lately, perhaps now I know the reason behind it.&quot; Says the company owner.</p>\n<p>&quot;This is very out of character I assure you. I will take care of it immediately. You, the idiot who doesn&#39;t bother to knock when a door is shut, pack your things. You&#39;re fired.&quot; Says your boss.</p>\n<hr>\n<p><i>People who come across as too aggressive can find it difficult to keep friends. They may dominate conversations or give their opinions too boldly and forcefully, leaving others feeling put off or disrespected.</p>\n<p>People with an aggressive style may get other people to do things their way at times, but more often than not, they end up being rejected or disliked. They often lose the respect of others. In this case, you lost the respect of your company, your boss, and even ended up losing your job. Ouch.</i></p>\n<hr>\n<p><b>Scroll back up and try again.</b></p>",
				'attributes': ["score-=1"],
			},
			'I need to take action. I will go knock on my boss\'s door and ask him if he has a moment to talk.': {
				'clear': true,
				'text': "<p><span style=\"background-color:LimeGreen; color:white;\">\nEffectiveness: <b>+1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took an <b>ASSERTIVE</b> path. Assertiveness is an extremely valuable skill when it comes to social interaction and communication. Being assertive means being able to stand up for your own or other people&#39;s rights in a calm and positive way, without being either aggressive, or passively accepting of things that negatively affect you or others around you.</i></p>\n<hr>\n<p>You knock on the door, you are feeling confident and in control of your temper. \nYou know what you need, you know what you have to offer the company, and you are prepared to do whatever it takes to get out of the rut you have been in.</p>\n<p>As you knock, you hear the voice of your boss coming from behind the door. </p>\n<hr>\n<p>&quot;I am in the middle of a meeting, you will have to come back later.&quot; Says your boss</p>\n<hr>\n<p><i>How do you respond?</i></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Of course sir. Sorry to inturrupt.\" role=\"link\" tabindex=\"0\">Of course sir. Sorry to inturrupt.</a></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Sorry to inturrupt. However I do have something important to discuss with you. I will be back in an hour so we can sit and go over it.\" role=\"link\" tabindex=\"0\">Sorry to inturrupt. However I do have something important to discuss with you. I will be back in an hour so we can sit and go over it.</a></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"You have waited long enough. You know what you have to offer and your boss will be grateful for the interuption. I'm coming in!\" role=\"link\" tabindex=\"0\">You have waited long enough. You know what you have to offer and your boss will be grateful for the interuption. I&#39;m coming in!</a></p>",
				'attributes': ["score+=1"],
			},
			'Sorry to inturrupt. However I do have something important to discuss with you. I will be back in an hour so we can sit and go over it.': {
				'clear': true,
				'text': "<p><span style=\"background-color:LimeGreen; color:white;\">\nEffectiveness: <b>+1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took an <b>ASSERTIVE</b> path. Assertiveness is a difficult skill to master. In order to be assertive, you must learn to live in that sweet spot between being passive and being aggressive. Barging into a superior&#39;s office and barking demands will never get you the results you want, it will only come off as disrespectful. On the otherhand, doing nothing and expecting things to change in your life will almost never work either. In order to get what you want in life you must take ACTION. Assertive people take action in a way that is respectful yet still demands attention. Assertive people speak openly but do so from a place of mutual respect and open-mindedness. Assertive people are not confrontational, they are conversational.</i></p>\n<hr>\n<p>Your boss replies,\n&quot;Yes, that sounds great. I will speak to you in an hour.&quot;</p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Come back in an hour\" role=\"link\" tabindex=\"0\">Come back in an hour</a></p>",
				'attributes': ["score+=1"],
			},
			'You have waited long enough. You know what you have to offer and your boss will be grateful for the interuption. I\'m coming in!': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took an <b>AGGRESSIVE</b> path. You decided to barge into your boss&#39;s office and demand a conversation. Upon swinging open the door and greeting your boss with an angry, demanding look, you notice exactly who he was having a meeting with. It wasn&#39;t a coworker. Instead, the owner of your entire corporation is sitting across the table from your boss and he is looking at you with fire in his eyes. He is very angry with your actions.</i></p>\n<hr>\n<p>Looking you up and down, the company owner says to you, </p>\n<p>&quot;This is unnacceptable! What happened to respect?&quot; </p>\n<p>The company owner moves his attention to your boss.</p>\n<p>&quot;Is this the way you are running your branch? Employees just barge through the doors in fits of rage? I knew this branch has been less productive lately, perhaps now I know the reason behind it. What kind of boss would hire such a disrespectful person?&quot; Says the company owner.</p>\n<p>&quot;This is very out of character I assure you, and had I known this type of behavior would arise I never would have hired them in the first place. I will take care of it immediately. You, the idiot who doesn&#39;t bother to knock when a door is shut, pack your things. You&#39;re fired.&quot; Says your boss.</p>\n<hr>\n<p><i>Aggressive people are natural leaders and they even tend to make friendships easily. However, people who come across as too aggressive can find it difficult to keep those friends. They are abrasive and rude. They may dominate conversations or give their opinions too boldly and forcefully, leaving others feeling put off or disrespected.</p>\n<p>People with an aggressive style may get other people to do things their way at times, but more often than not, they end up being rejected or disliked. They often lose the respect of others. In this case, you lost the respect of your company, your boss, and even ended up losing your job. Ouch.</i></p>\n<hr>\n<p><b>Scroll back up and try again.</b></p>",
				'attributes': ["score-=1"],
			},
			'Of course sir. Sorry to inturrupt.': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took a <b>PASSIVE</b> path. You decided to just walk away from what you want. While this path may allow you to keep your job, you will not grow in the way you are seeking and you will continue to feel stuck and helpless.</p>\n<p>When we continually respond passively in life, or when we are too afraid to speak up, stand up, and do what is best for us, we fall into a pattern of unhappiness that we can begin to accept as our only possible reality. We can even start to feel unworthy of the things we want in life. This can lead to us giving up on ever trying to be happy and/or successful.</p>\n<p>If you start to feel like your opinions or feelings don&#39;t count, it can lower your confidence and rob you of the chance to get recognition and positive feedback for your good ideas.</i></p>\n<hr>\n<p>You return to your desk and decide not to bring this up anymore... You think that you bit off way more than you could chew and that you are probably better off just keeping your head down. </p>\n<hr>\n<p><b>Scroll back up and try again.</b></p>",
				'attributes': ["score-=1"],
			},
			'Come back in an hour': {
				'clear': true,
				'text': "<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p>You return to your boss&#39;s office an hour later. You are nervous. Did you hype yourself up too much? Is he going to be upset that I interupped him earlier? </p>\n<hr>\n<p>What do you do?</p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"You knock on the door. It's now or never!\" role=\"link\" tabindex=\"0\">You knock on the door. It&#39;s now or never!</a></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"You decide to wait. Maybe it would be better to come back another day when he is less busy.\" role=\"link\" tabindex=\"0\">You decide to wait. Maybe it would be better to come back another day when he is less busy.</a></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"You open the door and fling it wide. You told him you were coming so he should be expecting you.\" role=\"link\" tabindex=\"0\">You open the door and fling it wide. You told him you were coming so he should be expecting you.</a></p>",
			},
			'You knock on the door. It\'s now or never!': {
				'clear': true,
				'text': "<p><span style=\"background-color:LimeGreen; color:white;\">\nEffectiveness: <b>+1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You picked an <b>ASSERTIVE</b> path. Assertive people embody these traits, being direct, respectful, and action oriented. You had an arrangement with your boss, he expected you to arrive at his office in an hour so, by arriving on time, you showed that you can be direct with what you are planning to do. Even though he knew you were coming, your boss is your superior so knocking on the door shows that you respect him and his position as your boss. Finally, you knew it was now or never and instead of postponing things, you sprung into action and decided to talk to your boss, despite being nervous. Assertiveness does not eliminate nervousness or doubt, intead it is a choice to ignore those thoughts and instead take action in order to get what you want out of your life.</i></p>\n<hr>\n<p>&quot;Yes, yes, come on in!&quot; Your boss says in reply to the knock\n&quot;Ah, I was expecting you! Sorry about earlier, I was having a meeting with the owner of our corporation. What was it you were wanting to discuss? I hope it&#39;s quick, I am very busy today. You said it was important?&quot; Says your boss</p>\n<hr>\n<p><i>You notice your boss seems a bit on edge. He is acting a bit frantic and seems to be in a hurry. How do you respond?</i></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"I am tired of being overlooked by this company! You all have no idea how much value I can bring to you. I need a raise or else I am out of here. You can try and fail to go out there and do my job. Let's see how far you get without me!\" role=\"link\" tabindex=\"0\">I am tired of being overlooked by this company! You all have no idea how much value I can bring to you. I need a raise or else I am out of here. You can try and fail to go out there and do my job. Let&#39;s see how far you get without me!</a></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Well I'm not sure it is quite as important as I implied... I am sorry for bothering you earlier. Should I come back later?\" role=\"link\" tabindex=\"0\">Well I&#39;m not sure it is quite as important as I implied... I am sorry for bothering you earlier. Should I come back later?</a></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"I feel like I am not living up to my potential with how the company is utilizing me. I have a lot of new and interesting ideas that I think would exicte you and take our company to a much more profitable place.\" role=\"link\" tabindex=\"0\">I feel like I am not living up to my potential with how the company is utilizing me. I have a lot of new and interesting ideas that I think would exicte you and take our company to a much more profitable place.</a> </p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"You are <i>ALWAYS</i> busy... Whatever. I guess I will come back later.\" role=\"link\" tabindex=\"0\">You are <i>ALWAYS</i> busy... Whatever. I guess I will come back later.</a></p>",
				'attributes': ["score+=1"],
			},
			'You decide to wait. Maybe it would be better to come back another day when he is less busy.': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took a <b>PASSIVE</b> path. Passive individuals allow themselves to be walked all over. These people tend to be quiet and often have issues with a low sense of self-worth, low self-respect, and don’t think that their own needs have importance. Instead of springing into action, passive people tend to concede to the needs and demands of others in their lives. Passive people tend to speak softly, and allow others to infringe on their space, time,  and even rights. These people often feel as if their life is out of their own control, and are mostly unaware of any resentment that is building up in their lives and relationships with others. This can lead to very unhealthy circumstances such as random violent outburts, acts of aggression toward people who care about them, and even self-harm. This isn&#39;t to say that passive decisions always lead to bad outcomes, there are situations that you should walk away from and take a passive approach. However, having an overly passive personality can and likely will limit your own potential for happiness, success, and fulfilment.</i></p>\n<hr>\n<p>Your boss replies, &quot;Oh, well if it isn&#39;t important just send me an email, I am actually very busy at the moment.&quot;</p>\n<hr>\n<p>You walk away, returning to your desk. You feel a sense of relief. It would have been so akward. You feel glad you avoided being possibly rejected, that would have been too hard for you to deal with. &quot;It&#39;s better this way&quot;, you tell yourself. </p>\n<hr>\n<p>Nothing changes in your life. You felt a brief sense of relief by avoiding the situation. However, you still feel like you will never be fulfilled at your job. You quit a week later and after struggling to find a new position at a different company, you end up taking a lower position than you once had. You now make significantly less money than before.</p>\n<hr>\n<p><b>Scroll up and try again</b></p>",
				'attributes': ["score-=1"],
			},
			'You open the door and fling it wide. You told him you were coming so he should be expecting you.': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took an <b>AGGRESSIVE</b> path. Self-Control is a big component of how passive or aggressive you are. Being passive is a failure of self-control; students who are passive just give up, this approach will never get you what you want in life. However, aggressiveness is also a failure of self-control. People who are aggressive haven’t learned to control their actions and tend to act before thinking things through. They act on emotion and have a tendency to be inconsiderate to others because of this. Taking action to get what you want is not a bad thing, but it should always be actions that are fully thought through. Barging into your boss&#39;s office without knocking is disrespectful, unprofessional, and not well thought out. Let&#39;s see how it plays out...</i></p>\n<hr>\n<p>You open the door without knocking. It flings open abruptly, making a loud thud as it hits the other side of the wall. Apparently this office does not have a door catch to keep it from hitting the wall...</p>\n<p>&quot;Yes!? Can I help you??&quot; You boss says as he stares you down. He does not look happy.</p>\n<p>&quot;Do you have a good reason for barging into my office unnannounced?&quot; He says</p>\n<p>&quot;Oh, you are the one who knocked earlier. You said it was important. Well, it&#39;s going to have to wait. I have a million things on my plate today and you are, quite frankly, at the bottom of my list. Come back tomorrow morning, and next time, when the door is shut, knock before you just walk into my office.&quot; Your boss says as he motions for you to leave his office.</p>\n<hr>\n<p><i>Maybe this would have worked on another day.</i></p>\n<p><b>Scroll back up and try again.</b></p>",
				'attributes': ["score-=1"],
			},
			'I am tired of being overlooked by this company! You all have no idea how much value I can bring to you. I need a raise or else I am out of here. You can try and fail to go out there and do my job. Let\'s see how far you get without me!': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took an <b>AGGRESSIVE</b> path. People who are aggressive don’t control their anger. They lash out with angry words and even physical violence at times when confronting difficult issues. They have a short fuse and are quick to blow up on others. By immediately lashing out at your boss you set the wrong tone for the entire conversation. When faced with immediate aggression, most people will go on the defensive and will be much more unlikely to listen to anything you have to say. Let&#39;s see how this action plays out...</i></p>\n<hr>\n<p>&quot;Overlooked? Undervalued? I see you now, that much is certain. And as for your value, what is your salary? 60,000 a year? Our branch has been doing poorly lately. In fact, the owner of our company is who I was meeting with earlier when you came knocking on my door. Ever since that meeting I&#39;ve been trying my hardest to find ways to make our company more profitable. Now that you have barged in here like this I think I finally have a solution. You are valuable, you are worth an extra $60,000 a year to this company. You&#39;re fired, get out of my office. I can think of a thousand better ways for our company to spend $60,000 a year.&quot;</p>\n<hr>\n<p><i>Wow, that blew up quickly. You lost your job. Congrats.</i></p>\n<p><b>Scroll back up and try again.</b></p>",
				'attributes': ["score-=1"],
			},
			'Well I\'m not sure it is quite as important as I implied... I am sorry for bothering you earlier. Should I come back later?': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took a <b>PASSIVE</b> path. Someone who is passive tends to avoid conflict and will agree with others despite how they feel. They may isolate themselves from potentially akward situations, conflict, and group settings. Even if they do confront these situations, such as being willing to work in a group or speak to their boss, may appear withdrawn. They may avoid eye contact and speak softly without much inflection. They are often afraid to speak up and will overuse apologies, even for things that are not their fault. There are many reasons passive people do this. It could be that they are angry and afraid to express it, or maybe they are simply avoiding anything that may be viewed as conflict or struggle for them. Whatever the case, acting passively will not allow you to take control of your life and get what you want out of it.</i></p>\n<hr>\n<p>&quot;Actually, that would be best. If it isn&#39;t urgent, I have a lot to take care of at the moment. Actually, if it isn&#39;t urgent, send an email okay? I&#39;ll get back to you when I can.&quot; Says your boss</p>\n<hr>\n<p>You leave your boss&#39;s office, not feeling any better about your life. You decide not to even bother sending the email. Nothing in your life changes.</p>\n<p><b>Scroll back up and try again.</b></p>",
				'attributes': ["score-=1"],
			},
			'I feel like I am not living up to my potential with how the company is utilizing me. I have a lot of new and interesting ideas that I think would exicte you and take our company to a much more profitable place.': {
				'clear': true,
				'text': "<p><span style=\"background-color:LimeGreen; color:white;\">\nEffectiveness: <b>+1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took an <b>ASSERTIVE</b> path. A person who is behaving assertively will be both respectful and clear when it comes to what they want. They are honest, fair, and direct and will match their body language to the expression of their message. Assertive people make good eye contact and invite open participation in their conversations. Assertive people will use a conversational tone while still expressing their opinion. While they are good at taking decisive action, people exhibiting assertiveness will also respect those around them. They don&#39;t open conversations with demands but instead use statements like &quot;I feel&quot; or &quot;I believe&quot; in order to get their thoughts across to others.</i></p>\n<hr>\n<p>&quot;Okay, you have my attention. What is your vision for our company?&quot; Says your boss.</p>\n<hr>\n<p><i>How do you respond?</i></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Well I have noticed that our sales are down this year. After going through the numbers I am certain that we are far below last year's numbers. I think we need to expand our reach using social media.\" role=\"link\" tabindex=\"0\">Well I have noticed that our sales are down this year. After going through the numbers I am certain that we are far below last year&#39;s numbers. I think we need to expand our reach using social media.</a></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Two words. Social. Media. I bet the dinosaurs up in the corporate offices are so out of touch with today's society they've never even considered reaching out to the younger generations to get them amped up! Out with the old and in with the new. I'm your guy. Period. When can I start turning this company around?\" role=\"link\" tabindex=\"0\">Two words. Social. Media. I bet the dinosaurs up in the corporate offices are so out of touch with today&#39;s society they&#39;ve never even considered reaching out to the younger generations to get them amped up! Out with the old and in with the new. I&#39;m your guy. Period. When can I start turning this company around?</a></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"ABORT! ABORT! I DIDN'T ACTUALLY THINK OF A GOOD IDEA! RUN AWAY WHILE I STILL HAVE A JOB!!\" role=\"link\" tabindex=\"0\">ABORT! ABORT! I DIDN&#39;T ACTUALLY THINK OF A GOOD IDEA! RUN AWAY WHILE I STILL HAVE A JOB!!</a></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Well <i>now that I finally have your attention</i> I was thinking of the obvious path for our company. Social media influence. If you knew anything about the world today you'd know that we are missing out on sales path that is more effecient easier and better suited for our products than telemarketing. Literally everyone knows that the telemarketing industry is beyong dying. It's dead.\" role=\"link\" tabindex=\"0\">Well <i>now that I finally have your attention</i> I was thinking of the obvious path for our company. Social media influence. If you knew anything about the world today you&#39;d know that we are missing out on sales path that is more effecient easier and better suited for our products than telemarketing. Literally everyone knows that the telemarketing industry is beyong dying. It&#39;s dead.</a></p>",
				'attributes': ["score+=1"],
			},
			'You are <i>ALWAYS</i> busy... Whatever. I guess I will come back later.': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took a <b>PASSIVE AGRESSIVE</b> path. A passive aggressive person is someone who appears outwardly passive, however, their anger manifests in subtle, indirect, or deceptive ways. Passive aggressive people tend to be incapable of dealing with the root of their anger or frustration, and often have misplaced anger due to feelings of powerlessness. This style of communication, is unproductive and will almost never end well for the aggressor.</i></p>\n<hr>\n<p>Your boss stares back at you coldly for a monent before saying, &quot;Excuse me? Yes I am busy. The company happens to be doing poorly this year and the owner thinks it has something to do with my abilities as a leader. I was just tasked with finding a way to make us profitable or there will be company-wide lay-offs. I think I just found my solution. Get out of my office.&quot; </p>\n<hr>\n<p>A few days later your boss announces that the company is laying off 5 different employees. Your name is first on the list. </p>\n<p><b>Scroll back up and try again.</b></p>",
				'attributes': ["score-=1"],
			},
			'Well I have noticed that our sales are down this year. After going through the numbers I am certain that we are far below last year\'s numbers. I think we need to expand our reach using social media.': {
				'clear': true,
				'text': "<p><span style=\"background-color:LimeGreen; color:white;\">\nEffectiveness: <b>+1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took an <b>ASSERTIVE</b> path. Being assertive means having or <b>demonstrating</b> a confident personality. An assertive person appears confident and assured in any given conversation. Assertive individuals also respect others as equals, have trust in themselves, and seek out polite ways to communicate. This is how we can distinguish assertiveness from aggressiveness.</i></p>\n<hr>\n<p>&quot;Well you are right about our company&#39;s finances this year. We are in a bit of a rough spot right now. In fact, when I was meeting with the company owner earlier today he informed me that if we are unable to increase our sales soon, we will be forced to lay some of our employees off. Obviously I want to avoid this at all costs.&quot; You boss replies</p>\n<p>&quot;You mentioned social media. I&#39;ve thought about taking our company this route before but was unable to come up with a solid plan for shifting our focus in that direction. What exactly are you suggesting we do with social media?&quot;</p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Easy. Put me in charge then give me a raise and watch your company grow. Obviously when you thought about social media you had no idea what you were doing. This is your chance to show the company that you hired the best. Me.\" role=\"link\" tabindex=\"0\">Easy. Put me in charge then give me a raise and watch your company grow. Obviously when you thought about social media you had no idea what you were doing. This is your chance to show the company that you hired the best. Me.</a></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Yeah it's pretty obvious you wouldn't know how to implement social media into our sales design. That's okay. It's a good thing you hired me. I know exactly what to do. First we need a full time social media manager to handle all of our company pages. Next we need to create hype around our products. I suggest hiring an influencer to promote them on their social media accounts.\" role=\"link\" tabindex=\"0\">Yeah it&#39;s pretty obvious you wouldn&#39;t know how to implement social media into our sales design. That&#39;s okay. It&#39;s a good thing you hired me. I know exactly what to do. First we need a full time social media manager to handle all of our company pages. Next we need to create hype around our products. I suggest hiring an influencer to promote them on their social media accounts.</a></p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"I know you have been busy lately so I appreciate you giving me an opportunity to discuss this with you. I've given this a lot of thought and here is what I think we need to do as a company. First we need a full time social media manager to handle all of our company pages. Next we need to create hype around our products. I suggest hiring an influencer to promote them on their social media accounts.\" role=\"link\" tabindex=\"0\">I know you have been busy lately so I appreciate you giving me an opportunity to discuss this with you. I&#39;ve given this a lot of thought and here is what I think we need to do as a company. First we need a full time social media manager to handle all of our company pages. Next we need to create hype around our products. I suggest hiring an influencer to promote them on their social media accounts.</a></p>",
				'attributes': ["score+=1"],
			},
			'Two words. Social. Media. I bet the dinosaurs up in the corporate offices are so out of touch with today\'s society they\'ve never even considered reaching out to the younger generations to get them amped up! Out with the old and in with the new. I\'m your guy. Period. When can I start turning this company around?': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took an <b>AGGRESSIVE</b> path. An aggressive individual is a person who often overestimates himself and is self-centered. They prefer to downplay others and their potential for decision-making. They often try to assert their beliefs by being harsh on others, insulting them, shouting at them, or even using violent physical methods in the most extreme examples. They tend to come across as overly dominant, tyrannical, or even violent in the eyes of those around them.</i></p>\n<hr>\n<p>&quot;Yeah, slow down there pal. First of all, those <i>dinosaurs</i> write your paychecks, never forget that. Second of all, I am not sure that having you run a social media department is the best option for our company at this time. I&#39;ll let you know if I change my mind in the future.&quot; Says your boss.</p>\n<hr>\n<p><i> Well that didn&#39;t exactly go as planned now did it? Pehaps you came on a little strong? </i></p>\n<hr>\n<p><b>Scroll back up and try again.</b></p>",
				'attributes': ["score-=1"],
			},
			'ABORT! ABORT! I DIDN\'T ACTUALLY THINK OF A GOOD IDEA! RUN AWAY WHILE I STILL HAVE A JOB!!': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took a <b>PASSIVE</b> path. Those who act passively are have mastered the art of avoiding uncomfortable situations. They are afraid that they can never really articulate their beliefs or their desires. A passive individual lacks confidence and, because of this trait, may be exploited by others. Another main feature of such a person is that he is not going to face the situation or problem, but would rather run away and avoid it entirely.</i></p>\n<hr>\n<p>You stand in the doorway speechless and shaking. </p>\n<p>Your boss stares at you puzzled for a moment before saying, &quot;Are you okay? Are you going to say anything?&quot;</p>\n<p>You panic, turn around, and run back awkwardly to your desk.</p>\n<hr>\n<p><i>You have successfully dodged a basic human interaction, mission accomplished? Wait, no. That isn&#39;t a good thing! You are still stuck in your dead end job and now you just look like a complete weirdo to your boss! Shame, regret, and perpetual akwardness now line every hallway and meeting at your job.</i></p>\n<p>You end up quiting a week later... You find a new job making even less money.</p>\n<hr>\n<p><b>Scroll back up and try again</b></p>",
				'attributes': ["score-=1"],
			},
			'Well <i>now that I finally have your attention</i> I was thinking of the obvious path for our company. Social media influence. If you knew anything about the world today you\'d know that we are missing out on sales path that is more effecient easier and better suited for our products than telemarketing. Literally everyone knows that the telemarketing industry is beyong dying. It\'s dead.': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took a <b>PASSIVE AGRESSIVE</b> path. Passive aggressive behavior is a pattern of indirectly expressing negative feelings instead of openly addressing them. In this case, you let your emotions seep into your conversation by casually saying things like &quot;now that I finally have your attention&quot; and &quot;If you knew anything about the world today&quot;. Statements like these imply that the person on the other end of the conversation has both undervalued you, should feel bad, and isn&#39;t as smart as you. They are passive but obvious signals of aggression and are all but guaranteed to change the mood of any conversation into a hostile one.</i></p>\n<hr>\n<p>&quot;Well, you will have to excuse me if I have been a bit distracted lately, running a company of this size does take a lot of work on my part. Not to mention, after speaking to the company owner just a short while ago, I have been tasked with finding a way to increase our sales to match or exceed last year&#39;s numbers or there will be company wide lay-offs. But please, tell me again how I have failed to recognize your personal needs.&quot; You boss replies, clearly frustrated.</p>\n<p>&quot;I&#39;ll tell you what, you want to lead social media? It&#39;s yours. But, you are going to have to take a significant paycut until further notice. Also, I need you to tell Jacobs, Wilson, Smith, and Garrison that they have been laid off. Maybe then you will understand what my job is like.&quot; Says your boss.</p>\n<hr>\n<p><i>Ooof. Not only did you LOOSE money from your yearly salary, you also get to be the company bad guy while looking like you&#39;ve been promoted. Something tells me you aren&#39;t going to be too popular around the office...</i></p>\n<hr>\n<p><b>Scroll back up and try again</b></p>",
				'attributes': ["score-=1"],
			},
			'Easy. Put me in charge then give me a raise and watch your company grow. Obviously when you thought about social media you had no idea what you were doing. This is your chance to show the company that you hired the best. Me.': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took an <b>AGGRESSIVE</b> path. Aggression is a common human behavioral characteristic. However, if we can learn to change our aggressive stance into an assertive one, we can be much more successful when it comes to communicating with other. The key difference between assertiveness and aggressiveness is that someone who is assertive respects other people’s viewpoints while being direct and sure to express his viewpoint, while one who is aggressive assumes his viewpoint is the only one that matters. Aggressive individuals tend to come across as arrogant whereas those who are assertive tend to come off as confident. Enthusiasm and passion can be a good thing, but it must be presented in a way that makes you look confident instead of appearing to have an exaggerated sense of one&#39;s own importance or abilities. </i></p>\n<hr>\n<p>&quot;Woah there. Slow down. Look, I like the idea and clearly you feel like you are the right man for the job. However, at this time I just don&#39;t see us being able to move you up to a social media management position. I will let you know if things change in the future.&quot; You boss replies bluntly.</p>\n<p>&quot;Now, I appologize, but I am going to have to ask you to step back out of my office and get back to work, I have a million things on my mind and even more piling up on my desk. Next time, send an email.&quot; He says as he gestures for you to leave.</p>\n<hr>\n<p>You go back to your desk furious. </p>\n<p>&quot;How could he be so stupid? I should be in charge of this whole company!&quot; You say in your head.\n&quot;THAT&#39;S IT, I&#39;VE HAD ENOUGH OF THIS PLACE! HAVE FUN WATCHING YOUR COMPANY GO BANKRUPT AS YOU STAY IN THE STONEAGES OF SALES!&quot; You yell out loud.</p>\n<p>After the outburst, your boss emerges from his office. He looks incredibly angry.\n&quot;YOU! MY OFFICE, NOW.&quot; He says.</p>\n<hr>\n<p>You follow your boss back into his office.</p>\n<p>&quot;You think this is how you get what you want? I was just going over the numbers for social media marketing so I could write a proposal to my boss. I had thought on throwing your name in the ring for a possible promotion, but I was hesitant because of how arrogant you sounded earlier. I was right to go with my gut. We don&#39;t need people with short fuses trying to push sales, we need confidence and competence. You&#39;re fired.&quot;</p>\n<p><i>Well, you blew up and then everything blew up in your face because of it. No bueno.</i></p>\n<p><b>Scroll back up and try again</b></p>",
				'attributes': ["score-=1"],
			},
			'Yeah it\'s pretty obvious you wouldn\'t know how to implement social media into our sales design. That\'s okay. It\'s a good thing you hired me. I know exactly what to do. First we need a full time social media manager to handle all of our company pages. Next we need to create hype around our products. I suggest hiring an influencer to promote them on their social media accounts.': {
				'text': "<p><span style=\"background-color:red; color:white;\">\nEffectiveness: <b>-1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took a <b>PASSIVE AGRESSIVE</b> path. Passive aggressive behavior can be intensely frustrating for those on the other end of the conversation because it&#39;s hard to identify, difficult to prove, and may sometimes even be unintentional. Passive aggression can lead to more conflict and communication issues, because people who are passive agressive struggle to have direct and honest conversation about underlying problems. In this senario, you allowed your frustration with how you have been treated at work to leak into the conversation. These should have been two seperate conversations. Focus on what is more important to you, either talking about your ideas, or talking about how you feel about being looked over lately, but don&#39;t let your frustrations leak into either conversations in a negative way.</i></p>\n<hr>\n<p>&quot;I&#39;m sorry, did I hear that right?&quot; Your boss replies.\n&quot;That sounded an awful lot like you were insulting my intelligence, am I right?&quot; He continues.\n&quot;Well, interestingly enough, I happen to be your boss. Also, I don&#39;t appreciate people who come into my office, sit across from me, and then proceed to insult my intelligence. You&#39;re lucky I don&#39;t fire you right now. Get out of my office.&quot; He says.</p>\n<hr>\n<p>You shuffle awkwardly out of the room and back to your desk. You feel awful. That was your chance and you blew it. You let your emotions get the best of you and even casually insulted your boss. Not a good look.</p>\n<p><b>Scroll back up and try again.</b></p>",
				'attributes': ["score-=1"],
			},
			'I know you have been busy lately so I appreciate you giving me an opportunity to discuss this with you. I\'ve given this a lot of thought and here is what I think we need to do as a company. First we need a full time social media manager to handle all of our company pages. Next we need to create hype around our products. I suggest hiring an influencer to promote them on their social media accounts.': {
				'clear': true,
				'text': "<p><span style=\"background-color:LimeGreen; color:white;\">\nEffectiveness: <b>+1</b>\n</span></p>\n<p><span style=\"background-color:Yellow; color:Black;\">\nEffectiveness Score: <b>{score}</b>\n</span></p>\n<p><i>You took an <b>ASSERTIVE</b> path. You have felt overlooked lately and it is natural to feel frustrated. However, instead of allowing those frustrations to steer the conversation, you gave your boss the benefit of the doubt and let him know that you are aware of how busy he has been lately. You followed this by showing respect and being direct with your ideas. Assertiveness is based on mutual respect. It&#39;s a highly effective and diplomatic communication style. Being assertive shows that you respect yourself because you&#39;re willing to stand up for your interests and express your thoughts and feelings. It also demonstrates that you&#39;re aware of others&#39; responsibilites and are willing to work on resolving conflicts in a way that is mutually beneficial. Of course, it&#39;s not just what you say — your message — but also how you say it that&#39;s important. If you communicate in a way that&#39;s too passive or too aggressive, your message may get lost because people are too busy reacting to your delivery.</i></p>\n<hr>\n<p>&quot;It has certainly been a busy time for me, but I am actually really glad I was able to finally meet with you in person today. I have read through most of your emails and I have been meaning to make time to get back to you about some of your ideas. Unfortunately I have just been flooded with meetings and paperwork lately, my apologies.&quot; You boss replies in a respectful tone.</p>\n<p>He seem to be genuine in his response and very interested in what you have to say about social media marketing.</p>\n<p>&quot;Anyways, I love your plan. I think it&#39;s just the thing I need to take to my boss and get our company back on track. Earlier, when you first came to my door, I was meeting with the owner of the company and he told me that I needed to find a way to increase sales for our company or else there would be lay-offs.&quot; He says.</p>\n<p>&quot;Obviously I&#39;ve been wanting to avoid laying any one off all costs. I think your idea has the potential to turn things around and avoid lay-offs. How would you feel about heading a social media marketing department for our company?&quot; You boss says to you.</p>\n<hr>\n<p>How do you respond?</p>\n<hr>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Thank you for the opportunity. I would love to take this on. When can I start?\" role=\"link\" tabindex=\"0\">Thank you for the opportunity. I would love to take this on. When can I start?</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"I think I am going to have to decline. I just hate you and this company so much.\" role=\"link\" tabindex=\"0\">I think I am going to have to decline. I just hate you and this company so much.</a></p>",
				'attributes': ["score+=1"],
			},
			'Thank you for the opportunity. I would love to take this on. When can I start?': {
				'clear': true,
				'text': "<p><span style=\"background-color:LimeGreen; color:white;\">\nEffectiveness: <b>+1</b>\n</span></p>\n<p><i><span style=\"color:Black; font-size: 3em; text-align:center\">\n<b>You did it!</b>\n</span> </p>\n<p>You climbed the corporate ladder and are moving up in the world. I hope that you have learned a thing or two about effective conversation and how to be more assertive in order to get what you want out of life. I am not foolish enough to say that being assertive will always get you what you want, but it will undoubtably get you further than doing nothing or acting out in anger. Your future is in your hands now, good luck.</i></p>\n<p><span style=\"background-color:Yellow; color:Black; font-size: 3em; text-align:center\">\nFINAL EFFECTIVENESS SCORE: <b>{score}</b>\n</span></p>\n<hr>\n<p>How did you score? If you ended with a positive final effectiveness score, congratulations! You did awesome and you are a great communicator. If you ended with a negative score, I hope you read through the feedback on each section and learned a thing or two about effective communication styles and how to be more assertive. </p>",
				'attributes': ["score+=1"],
			},
			'I think I am going to have to decline. I just hate you and this company so much.': {
				'text': "<p><i>Wait, what? No. Don&#39;t do that. I don&#39;t even know why that response is an option. Go back up and select the other choice, take the job and appreciate the opportunity to be more successful in your life!</i></p>",
			},
		},
	},
}
})();