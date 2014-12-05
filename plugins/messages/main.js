var requires = [
    "root/externallib/text!root/plugins/messages/messages.html"
];


define(requires, function (messagesTpl) {

    var plugin = {
        settings: {
            name: "messages",
            type: "general",
            icon: "plugins/messages/icon.png",
            menuURL: "#messages",
            lang: {
                component: "core"
            }
        },

        routes: [
            ["messages", "messages", "showMessages"],
            ["messages/conversation/:userId", "messages_conversation", "showConversation"]
        ],

        templates: {
            "messages": {
                html: messagesTpl
            }
        },

        wsPrefix: "",

        /**
         * Determines is the plugin is visible.
         * It may check Moodle remote site version, device OS, device type, etc...
         * This function is called when a alink to a plugin functinality is going to be rendered.
         *
         * @return {bool} True if the plugin is visible for the site and device
         */
        isPluginVisible: function() {
            // The plugin is visible either if is available the remote service for pulling messages or
            // the platform support Push messages.

            var visible = false;

            if (MM.util.wsAvailable('local_mobile_core_message_get_messages')) {
                MM.plugins.messages.wsPrefix = "local_mobile_";
                visible = true;
            } else if (MM.util.wsAvailable('core_message_get_messages')) {
                visible = true;
            }

            return visible;
        },

        /**
         * Messages plugin main entry point for the user
         * It may display the button for enable messages or the list of messages received
         *
         */
        showMessages: function() {
            var html, tpl;

            MM.panels.showLoading('center');
            MM.panels.hide("right", "");
            MM.Router.navigate('');

            $('a[href="#messages"]').addClass('loading-row');

            // Checks if all the messaging WS are available.
            if (MM.util.wsAvailable(MM.plugins.messages.wsPrefix + 'core_message_get_contacts')) {
                MM.plugins.messages._renderRecentMessages();
            } else {
                MM.plugins.messages._renderMessageList();
            }
        },

        showConversation: function(userId) {

            var params = {
                useridto: MM.config.current_site.userid,
                useridfrom: userId,
                type: 'conversations',
                read: 0,
                newestfirst: 1,
                limitfrom: 0,
                limitnum: 50
            };

            // First, messages received.
            MM.plugins.messages._getRecentMessages(
                params,
                function(messagesReceived) {
                    // Now, messages sent.
                    params.useridto = userId;
                    params.useridfrom = MM.config.current_site.userid;

                    MM.plugins.messages._getRecentMessages(
                        params,
                        function(messagesSent) {
                            MM.plugins.messages._renderConversation(userId, messagesReceived, messagesSent);
                        },
                        function(e) {
                            MM.popErrorMessage(e);
                        }
                    );
                },
                function(e) {
                    MM.popErrorMessage(e);
                }
            );
        },

        _renderConversation: function(userId, messagesReceived, messagesSent) {
            // Join the arrays and sort.
            var messages = messagesReceived.concat(messagesSent);
            // Sort by timecreated.
            messages = messages.sort(function (a, b) {
                a = parseInt(a.timecreated, 10);
                b = parseInt(b.timecreated, 10);

                return a - b;
            });
        },

        _renderMessages: function(messages) {
            tpl = {messages: messages};
            html = MM.tpl.render(MM.plugins.messages.templates.messages.html, tpl);
            MM.panels.show('center', html, {hideRight: true, title: MM.lang.s("messages")});
            $(".reply-button").on(MM.clickType, function(e) {
                e.preventDefault();
                var userId = $(this).data("useridfrom");
                if (MM.plugins.sendmessage) {
                    MM.plugins.sendmessage._displayMessageForm(userId);
                } else {
                    var url = MM.config.current_site.siteurl + "/message/index.php?user=" + MM.config.current_site.userid + "&id=" + userId;
                    window.open(url, "_system");
                }
            });
        },

         _format: function(text) {
            text = text.replace(/-{4,}/ig, '');
            text = MM.util.formatText(text, true);
            text = MM.util.createLinks(text).replace(/<br \/><br \/>/ig, "<br />");
            return text;
        },

        /**
         * Render the recent messages page.
         * Displays a list of contacts with last message (whatsapp/telegram style).
         */
        _renderRecentMessages: function() {
            MM.plugins.messages._renderMessageList(); // Temporary allow this

            var recentContactMessages = [];
            var recentContactsIds = {};

            var params = {
                useridto: MM.config.current_site.userid,
                useridfrom: 0,
                type: 'conversations',
                read: 0,
                newestfirst: 1,
                limitfrom: 0,
                limitnum: 50
            };

            // Get recent messages received (and sender).
            MM.plugins.messages._getRecentMessages(
                params,
                function(messages) {
                    // Find different senders in the messages list, in the latest 50 messages.
                    if (messages.length > 0) {
                        messages.forEach(function(m) {
                            if (!(m.useridfrom in recentContactsIds)) {
                                recentContactsIds[m.useridfrom] = {fullname: m.userfromfullname};
                                recentContactMessages.push({
                                    user: m.useridfrom,
                                    message: m.smallmessage,
                                    timecreated: m.timecreated,
                                });
                            }
                        });
                    }

                    // Now get my latest messages send. Maybe I didn't receive a response.
                    params.useridfrom = MM.config.current_site.userid;
                    params.useridto = 0;

                    MM.plugins.messages._getRecentMessages(
                        params,
                        function(messagesSent) {

                            if (messagesSent.length > 0) {
                                messagesSent.forEach(function(m) {
                                    if (!(m.useridto in recentContactsIds)) {
                                        recentContactsIds[m.useridto] = {fullname: m.usertofullname};
                                        recentContactMessages.push({
                                            user: m.useridto,
                                            message: m.smallmessage,
                                            timecreated: m.timecreated,
                                        });
                                    }
                                });
                            }

                            // Now, get my contacts (the function returns unread messages count for contacts,
                            // maybe some are not included in the latest 50).
                            MM.plugins.messages._getContacts(
                                function(contacts) {
                                    var types = ["online", "offline", "strangers"];
                                    types.forEach(function(type) {
                                        if (contacts[type] && contacts[type].length > 0) {
                                            contacts[type].forEach(function(contact) {
                                                if (contact.id in recentContactsIds) {
                                                    if (contact.profileimageurlsmall) {
                                                        recentContactsIds[contact.id]["profileimageurlsmall"] = contact.profileimageurlsmall;
                                                    }
                                                    if (typeof contact.unread != "undefined") {
                                                        recentContactsIds[contact.id]["unread"] = contact.unread;
                                                    }
                                                } else if (contact.unread) {
                                                    // Is a contact with unread messages, add it to the recent contact messages.
                                                    recentContactsIds[contact.id] = {
                                                        fullname: contact.fullname,
                                                        unread: contact.unread
                                                    };
                                                    recentContactMessages.push({
                                                        user: contact.id,
                                                        message: "...",
                                                        timecreated: 0,
                                                    });
                                                }
                                            });
                                        }
                                    });
                                },
                                function(e) {
                                    MM.log("Error retrieving contacts", "Messages");
                                }
                            );
                        },
                        function(e) {
                            MM.log("Error retrieving contacts", "Messages");
                        }
                    );
                },
                function(e) {
                    $('a[href="#messages"]').removeClass('loading-row');
                    MM.popErrorMessage(e);
                }
            );


            //$('a[href="#messages"]').removeClass('loading-row');
        },

        /**
         * Render a list of messages.
         * This function is used when the Moodle site doesn't have all the messaging functions available.
         */
        _renderMessageList: function() {

            var params = {
                useridto: MM.config.current_site.userid,
                useridfrom: 0,
                type: 'conversations',
                read: 0,
                newestfirst: 1,
                limitfrom: 0,
                limitnum: 50
            };

            MM.plugins.messages._getRecentMessages(
                params,
                function(messages) {
                    $('a[href="#messages"]').removeClass('loading-row');
                    MM.plugins.messages._renderMessages(messages);
                },
                function(e) {
                    $('a[href="#messages"]').removeClass('loading-row');
                    MM.popErrorMessage(e);
                }
            );
        },

        _getMessages: function(params, successCallback, errorCallback) {
            MM.moodleWSCall(
                MM.plugins.messages.wsPrefix + 'core_message_get_messages',
                params,
                function(messages) {
                    if (typeof successCallback == "function") {
                        successCallback(messages);
                    }
                },
                {
                    getFromCache: false,
                    saveToCache: true
                },
                function(e) {
                    if (typeof errorCallback == "function") {
                        errorCallback(e);
                    }
                }
            );
        },

        _getRecentMessages: function(params, successCallback, errorCallback) {

            params.read = 0;
            MM.plugins.messages._getMessages(
                params,
                function(messages) {
                    if (messages.messages) {
                        if (messages.messages.length >= params.limitnum) {
                            successCallback(messages);
                        } else {
                            params.limitnum = params.limitnum - messages.messages.length;
                            params.read = 1;
                            // Load more messages but now read messages.
                            MM.plugins.messages._getMessages(
                                params,
                                function(moremessages) {
                                    if (moremessages.messages) {
                                        successCallback(messages.messages.concat(moremessages.messages));
                                    } else {
                                        successCallback(messages.messages);
                                    }
                                },
                                function() {
                                    successCallback(messages);
                                }
                            );
                        }
                    } else {
                        if (messages.exception && messages.errorcode == "disabled") {
                            errorCallback(messages.message);
                        } else {
                            successCallback([]);
                        }
                    }
                },
                function(e) {
                    errorCallback(e);
                }
            );
        },

        /**
         * Get contacts
         * @param  {object} successCallback Success callback function
         * @param  {object} errorCallback   Error callback function
         */
        _getContacts: function(successCallback, errorCallback) {

            MM.moodleWSCall(
                MM.plugins.messages.wsPrefix + 'core_message_get_contacts',
                {},
                function(contacts) {
                    if (typeof successCallback == "function") {
                        successCallback(contacts);
                    }
                },
                null,
                function(e) {
                    if (typeof errorCallback == "function") {
                        errorCallback(e);
                    }
                }
            );
        },

        /**
         * Create a contact
         * @param  {number} userId userId to be added as contact
         * @param  {object} successCallback Success callback function
         * @param  {object} errorCallback   Error callback function
         */
        _createContact: function(userId, successCallback, errorCallback) {
            var data = {
                "userids[0]" : userId
            };

            MM.moodleWSCall(
                MM.plugins.messages.wsPrefix + 'core_message_create_contacts',
                data,
                function(warnings) {
                    if (warnings && warnings.length) {
                        if (typeof errorCallback == "function") {
                            errorCallback(warnings[0]['message']);
                        }
                        return;
                    }
                    if (typeof successCallback == "function") {
                        successCallback(contacts);
                    }
                },
                null,
                function(e) {
                    if (typeof errorCallback == "function") {
                        errorCallback(e);
                    }
                }
            );
        },

        /**
         * Delete a contact
         * @param  {number} userId userId to be deleted as contact
         * @param  {object} successCallback Success callback function
         * @param  {object} errorCallback   Error callback function
         */
        _deleteContact: function(userId, successCallback, errorCallback) {
            var data = {
                "userids[0]" : userId
            };

            MM.moodleWSCall(
                MM.plugins.messages.wsPrefix + 'core_message_delete_contacts',
                data,
                function(result) {
                    if (typeof successCallback == "function") {
                        successCallback();
                    }
                },
                null,
                function(e) {
                    if (typeof errorCallback == "function") {
                        errorCallback(e);
                    }
                }
            );
        },

        /**
         * Block a contact
         * @param  {number} userId userId to be blocked
         * @param  {object} successCallback Success callback function
         * @param  {object} errorCallback   Error callback function
         */
        _blockContact: function(userId, successCallback, errorCallback) {
            var data = {
                "userids[0]" : userId
            };

            MM.moodleWSCall(
                MM.plugins.messages.wsPrefix + 'core_message_block_contacts',
                data,
                function(warnings) {
                    if (warnings && warnings.length) {
                        if (typeof errorCallback == "function") {
                            errorCallback(warnings[0]['message']);
                        }
                        return;
                    }
                    if (typeof successCallback == "function") {
                        successCallback(contacts);
                    }
                },
                null,
                function(e) {
                    if (typeof errorCallback == "function") {
                        errorCallback(e);
                    }
                }
            );
        },

        /**
         * Unblock a contact
         * @param  {number} userId userId to be unblocked
         * @param  {object} successCallback Success callback function
         * @param  {object} errorCallback   Error callback function
         */
        _unblockContact: function(userId, successCallback, errorCallback) {
            var data = {
                "userids[0]" : userId
            };

            MM.moodleWSCall(
                MM.plugins.messages.wsPrefix + 'core_message_unblock_contacts',
                data,
                function(result) {
                    if (typeof successCallback == "function") {
                        successCallback();
                    }
                },
                null,
                function(e) {
                    if (typeof errorCallback == "function") {
                        errorCallback(e);
                    }
                }
            );
        },

        /**
         * Search contacts
         * @param  {string} text search text
         * @param  {string} onlyMyCourses search only in my courses
         * @param  {object} successCallback Success callback function
         * @param  {object} errorCallback   Error callback function
         */
        _searchContacts: function(text, onlyMyCourses, successCallback, errorCallback) {
            var data = {
                "searchtext" : text,
                "onlymycourses": onlyMyCourses
            };

            MM.moodleWSCall(
                MM.plugins.messages.wsPrefix + 'core_message_search_contacts',
                data,
                function(contacts) {
                    if (typeof successCallback == "function") {
                        successCallback(contacts);
                    }
                },
                null,
                function(e) {
                    if (typeof errorCallback == "function") {
                        errorCallback(e);
                    }
                }
            );
        },
    };

    MM.registerPlugin(plugin);

    // After register the plugin, bind events.
    $(document).bind('resume', MM.plugins.messages.check);
});