
    /**
     * Hi there,
     * Thanks for using this module, and good luck with your Electron app.
     *
     * ~ Zain
     * */
    const Application = require('electron').app;
    const FileSystem = require('fs');
    const Utils = require('util');
    const Zip = require('adm-zip');
    const HTTP = require('restler');
    const AppPath = Application.getAppPath() + '/';

    const errors = [
        'version_not_specified',
        'cannot_connect_to_api',
        'no_update_available',
        'api_response_not_valid',
        'update_file_not_found',
        'failed_to_download_update',
        'failed_to_apply_update'
    ];

    /**
     * */
    var Updater = {
        /**
         * The setup
         * */
        'setup': {
            'api': null,
            'logFile': 'updater-log.txt',
            'requestOptions': {},
            'callback': false
        },

        /**
         * The new update information
         * */
        'update': {
            'last': null,
            'source': null,
            'file': null
        },

        /**
         * Init the module
         * */
        'init': function(setup){
            this.setup = Utils._extend(this.setup, setup);
        },

        /**
         * Logging
         * */
        'log': function(line){
            // Log it
            console.log('[Updater] Updater: ', line);

            // Put it into a file
            if(this.setup.logFile){
                FileSystem.appendFileSync(AppPath + this.setup.logFile, line + "\n");
            }
        },

        /**
         * Triggers the callback you set to receive the result of the update
         * */
        'end': function(error){
            if(typeof this.setup.callback != 'function') return false;

            this.setup.callback.call(this,
                ( error != 'undefined' ?errors[error] :false ),
                this.update.last);
        },

        /**
         * Make the check for the update
         * */
        'check': function(callback){
            if(callback){
                this.setup.callback = callback;
            }

            // Get the current version
            var packageInfo = require(AppPath + 'package.json');

            // If the version property not specified
            if(!packageInfo.version){
                this.log('The "version" property not specified inside the application package.json');
                this.end(0);

                return false;
            }

            var requestOptions = Utils._extend({}, this.setup.requestOptions);
            if(!requestOptions.data){
                requestOptions.data = {};
            }

            // Send the current version along with the request
			requestOptions.data.current = packageInfo.version;
			requestOptions.data.platform = process.platform;
			requestOptions.data.arch = process.arch;
            console.log("[Updater] Platform:"+process.platform);
            console.log("[Updater] Arch:"+process.arch);
            console.log("[Updater] Version:"+packageInfo.version);

            // Check for updates
            HTTP.post(this.setup.api, requestOptions)
                .on('complete', function(result){
                    // If the request failed
                    if(result instanceof Error){
                        console.log('[Updater] Could not connect, ' + result.message);
                        Updater.end(1);
                        return false;
                    }

                    // Connected!
                    console.log('[Updater] Connected to ' + Updater.setup.api);

                    // Handle the response
                    try{
                        if(!result){
                            throw false;
                        }

                        // Parse the response
                        var response = typeof result === 'object' ? result : JSON.parse(result);

                        // If the "last" property is not defined
                        if(!response.last){
                            throw false;
                        }

                        // Update available
                        if(response.source){
                            console.log('[Updater] Update available: ' + response.last);

                            // Store the response
                            Updater.update = response;

                            // Download the update
                            Updater.download();

                        }else{
                            console.log('[Updater] No updates available');
                            Updater.end(2);

                            return false;
                        }


                    }catch(error){
                        console.log('[Updater] API response is not valid'+error);
                        Updater.end(3);
                    }
                });
        },

        /**
         * Download the update file
         * */
        'download': function(){
            var url = this.update.source,
                fileName = 'update.zip';

            this.log('Downloading ' + url);

            var requestOptions = Utils._extend({}, this.setup.requestOptions);
            requestOptions.decoding = 'buffer';

            // Download the file
			HTTP.get(url, requestOptions)
                .on('complete', function(data){
                    // The request failed
                    if(data instanceof Error){
                        console.log('[Updater] Could not find the update file.');
                        Updater.end(4);
                        return false;
                    }

                    // The file full path
                    var updateFile = AppPath + fileName;

                    // Create the file
                    FileSystem.writeFile(updateFile, data, null, function(error){
                        if(error){
                            console.log('[Updater] Failed to download the update to a local file.');
                            Updater.end(5);
                            return false;
                        }

                        // Store the update file path
                        Updater.update.file = updateFile;

                        // Success
                        console.log('[Updater] Update downloaded: ' + updateFile);

                        // Apply the update
                        Updater.apply();
                    });
                });
        },

        /**
         * Apply the update, it simply overwrites the current files!
         * */
        'apply': function(){
            try{
                this.log('Extracting the new update files.');

                var zip = new Zip(this.update.file);
                zip.extractAllTo(AppPath, true);

                this.log('New update files were extracted.');
                this.log('End of update.');

                // Success
                this.end();

            }catch(error){
                this.log('Extraction error: ' + error);

                // Failure
                this.end(6);
            }
        }
    };

    module.exports = Updater;
