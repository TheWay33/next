//os.type(); // Linux, Darwin or Window_NT
//os.platform(); // 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
var os=require("os");
var child=require('child_process').execFile;
const dialog=require('electron').dialog;
const axios=require('axios');
const {app,BrowserWindow}=require('electron');
const isDev=require('electron-is-dev');
const path=require('path');
const url=require('url');
const crypto=require('crypto');
const appDataPath=app.getPath("appData")+"\\NavCoin4";
const config={headers: {'Content-Type': 'application/x-www-form-urlencoded'},responseType: 'text'};
const defaults = {cwd:__dirname,env:process.env,shell:bshell,windowsVerbatimArguments:true};
const randomBytes=crypto.randomBytes(256);
const rpcuser=crypto.createHash('md5').update(randomBytes, 'utf8').digest('hex');
const rpcpassword = crypto.createHash('md5').update(randomBytes, 'utf8').digest('hex');
var executablePath;
var daemonPath;
var bshell=false;
var breindexchainstate=false;
var now=new Date(); 
var datetime=now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate()+'-'+now.getHours()+'-'+now.getMinutes()+'-'+now.getSeconds(); 
var rpcport;
var testnet;
var addnode;
var reindexchainstate;
var bTestnet=true;
var iniparser=require('iniparser');
var bError=true;
var newProcess;
var bExit=true;
let win;
var server=require("./server");
if (bTestnet)
{
	rpcport=44445;
	testnet=" -testnet";
	addnode=" -addnode=46.4.24.136";
}
else
{
	rpcport=44444;
	testnet="";
	addnode="";
}
if (!isDev)
{
	console.log('Running in development');
	const EBU = require('./updater');
	EBU.init({'api': 'https://next.navcommunity.net/update/'});
	EBU.check(function(error)
	{
		if(error)
		{
			console.log('NEXT update error:'+error);
			const dialogOpts = {
				type: 'error',
				buttons: ['OK'],
				title: 'Application Update Failed',
				message: "Update Failed",
				detail: error
			}
			if (error!="no_update_available") dialog.showMessageBox(dialogOpts);
			return false;
		}
		console.log('NEXT updated successfully!');
		const dialogOpts = {
			type: 'info',
			buttons: ['OK'],
			title: 'Application Update',
			message: "Update Success",
			detail: 'NEXT updated successfully!'
		}
		dialog.showMessageBox(dialogOpts);
	});		
}
else
{
	console.log('Running in production');
}
StartDaemon();
newProcess.on("exit", function ()
{
	console.log("Daemon stopped.");
	setTimeout(CloseApp, 1000);
});

function RestartDaemon(network)
{
	bExit=false;
	console.log("Restart Daemon:"+network);
	try
	{
		var fs = require('fs');
		var iniBuilder = require('ini-builder');
		var data = iniBuilder.parse(fs.readFileSync(appDataPath+"\\navcoin.conf"));
	}
	catch (e)
	{
		console.log("Configuration file exception occured.")
	}
	axios.post('http://localhost:3000/stop',{token:rpcpassword,rpcport:rpcport},config).then(function(res)
	{
		console.log(res.data);
		if (network=="testnet")
		{
			rpcport=44445;
			testnet=" -testnet";
			addnode=" -addnode=46.4.24.136";
			try
			{
				if(iniBuilder.find(data, 'testnet'))
				{
					console.log("Config file testnet key exist, changing value to 1");
					iniBuilder.find(data, 'testnet').value = '1';
				}
				else
				{
					console.log("Config file testnet key not exist, creating...");
					data.push({
						path: ['testnet'],
						value: '1'
					});
				}
			}
			catch (e)
			{
				console.log("Configuration file exception occured.")
			}
		}
		if (network=="mainnet")
		{
			rpcport=44444;
			testnet="";
			addnode="";
			try
			{
				if(iniBuilder.find(data, 'testnet'))
				{
					console.log("Config file testnet key exist, changing value to 0");
					iniBuilder.find(data, 'testnet').value = '0';
				}
				else
				{
					console.log("Config file testnet key not exist, creating...");
					data.push({
						path: ['testnet'],
						value: '0'
					});
				}
			}
			catch (e)
			{
			}
		}
		fs.writeFileSync(appDataPath+"\\navcoin.conf", iniBuilder.serialize(data));
	}).catch(function(err)
	{
		console.log(err);
	})
}

function StartDaemon ()
{
	try
	{
		var conf=iniparser.parseSync(appDataPath+"\\navcoin.conf");
		console.log("navcoin.conf file found.");
		console.log("Config.testnet:"+conf.testnet);
		if (conf.testnet=="1")
		{
			rpcport=44445;
			testnet=" -testnet";
			addnode=" -addnode=46.4.24.136";
			bTestnet=true;
		}
		else
		{
			rpcport=44444;
			testnet="";
			addnode="";
			bTestnet=false;
		}
	}
	catch (e)
	{
		console.log("navcoinf.conf file not found.");
	}
	if (breindexchainstate) reindexchainstate=" -reindex-chainstate"; else reindexchainstate="";
	var parameters = ["-rpcuser=" + rpcuser + " -rpcport=" + rpcport +" -rpcpassword=" + rpcpassword + testnet + reindexchainstate + " -server -rpcbind=127.0.0.1"+addnode];
	console.log("Daemon Parameters : [" + parameters + "]");
	if (os.platform()=="win32")
	{
		executablePath="navcoind.exe";
		bshell=false;
	}
	if (os.platform()=="linux")
	{
		executablePath="./navcoind";
		bshell=true;
	}
	if (os.platform()=="darwin")
	{
		executablePath=app.getAppPath()+"/./navcoind";
		bshell=true;
	}
	console.log("App Path : "+app.getAppPath());
	console.log("App Data Path : "+appDataPath);
	console.log("Shell : "+bshell);
	console.log("Platform : "+os.platform());
	console.log("Testnet : "+bTestnet);
	console.log("RPC Port : "+rpcport);
	if (os.platform()=="linux" || os.platform()=="darwin")
	{
		daemonPath=app.getAppPath()+"/navcoind";
		console.log("Setting daemon file as executable " + daemonPath);
		var buttons = ['OK', 'Cancel'];
		var chmodProcess=child("chmod +x " + daemonPath, null, defaults, function(err, data)
		{
			newProcess=child(executablePath, parameters, defaults, function(err, data)
			{
				if (err)
				{
					bError=false;
					console.log(err)
					dialog.showMessageBox({ type: 'error', buttons: buttons, message: err.message }, function (buttonIndex)
					{
						win=null;
						app.exit();
					});
				}
			});
			if (newProcess.pid!=undefined)
			{
				if (bExit==false)
				{
					win.loadURL(`file://${__dirname}/dist/index.html?rpcpassword=${rpcpassword}&rpcport=${rpcport}`);
				}
				bExit=true;
				console.log("Daemon started. PID :" + newProcess.pid);
			}
			else
			{
				console.log("Daemon start failed.");
			}
		});
	}
	else
	{
		newProcess=child(executablePath, parameters, defaults, function(err, data)
		{
			if (err)
			{
				bError=false;
				console.log(err)
				dialog.showMessageBox({ type: 'error', buttons: buttons, message: err.message }, function (buttonIndex)
				{
					win=null;
					app.exit();
				});
			}
		});
		if (newProcess.pid!=undefined)
		{
			if (bExit==false)
			{
				win.loadURL(`file://${__dirname}/dist/index.html?rpcpassword=${rpcpassword}&rpcport=${rpcport}`);
			}
			bExit=true;
			console.log("Daemon started. PID :" + newProcess.pid);
		}
		else
		{
			console.log("Daemon start failed.");
		}
	}
}

function CloseApp ()
{
	if(bError && bExit)
	{
		win.destroy();
	}
	else
	{
		StartDaemon();
		newProcess.on("exit", function ()
		{
			console.log("Daemon stopped.");
			setTimeout(CloseApp, 1000);
		});
	}
}

function createWindow ()
{
	if (!bError) return false;
	win=new BrowserWindow({width: 1275, height: 800});
	//win.setFullScreen(true);
	win.setMenu(null);
	win.loadURL(`file://${__dirname}/dist/index.html?rpcpassword=${rpcpassword}&rpcport=${rpcport}`);
   	var shell = require('electron').shell;
	win.webContents.on('new-window', function(event, url)
	{
		event.preventDefault();
		shell.openExternal(url);
		//const nwin = new BrowserWindow({width:800,height:600,show:true});
		//nwin.loadURL(url);
		//event.newGuest = nwin;
	});
    /*
	let $=require("jquery");
	win.webContents.on('did-finish-load', ()=>
	{
		win.webContents.executeJavaScript(`
    		$(document).on('click', 'a[class^="external"]', function(event) {
			event.preventDefault();
			shell.openExternal(this.href);
		});
		`);
    });*/
	win.webContents.on('console-message', function(level,message ,line ,sourceId)
	{
		//console.log('[CONSOLE]', "Level:"+level+" Message:"+message+" Line:"+line+" SourceId:"+sourceId);
		if (line=="mainnet" || line=="testnet") RestartDaemon(line);
	});
	//win.webContents.openDevTools();
	win.on('close', function (event)
	{
		event.preventDefault();
		win.webContents.executeJavaScript(`swal({onOpen: () => {swal.showLoading()},allowOutsideClick:false,text: 'Please wait...'});`);
		console.log("win.on -> close");
		axios.post('http://localhost:3000/stop',{token:rpcpassword,rpcport:rpcport},config).then(function(res)
		{
			console.log(res.data);
		}).catch(function(err)
		{
			console.log(err);
		})
	});
    win.on('closed', () => {
		console.log("win.on -> closed");
		if(bError && bExit)
		{
			win=null;
			app.exit();
		}
    })
}
app.on('ready', createWindow)
app.on('browser-window-created',function(e,window)
{
	window.setMenu(null);
	console.log("app.on -> browser-window-created");
});
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin' && bExit)
	{
		console.log("app.on -> window-all-closed");
		if(bError) app.quit();
    }
})
app.on('activate', () => {
    if (win === null)
	{
		console.log("app.on -> activate");
		createWindow();
    }
})