const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => res.send("I'm not dead! :D"));

app.listen(port, () => console.log(`listening at http://localhost:${port}`));

// https://gabrieltanner.org/blog/dicord-music-bot
// search: build a voice bot discord

// migrate to this https://www.npmjs.com/package/ytdl-core-discord

const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("ytdl-core");

const queue = new Map();

const prefix = "./lofi-";


client.once("ready", () => {
	console.log(`Logged in as ${client.user.tag}`);
	client.user.setActivity("24 hour lofi",
		{ type: "STREAMING" });

	const cecGuild = client.guilds.cache.filter(guild => guild.id === "700593210040516608");
	const serverQueue = queue.get(cecGuild.id);

	execute({content: "./lofi-play https://www.youtube.com/watch?v=5qap5aO4i9A"}, serverQueue, true);
});

client.once("reconnecting", () => {
	console.log("Reconnecting!");
});

client.once("disconnect", () => {
	console.log("Disconnect!");
});

client.on("message", async message => {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;

	const serverQueue = queue.get(message.guild.id);

	if (message.content.startsWith(`${prefix}play`)) {
		execute(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}skip`)) {
		skip(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}stop`)) {
		stop(message, serverQueue);
		return;
	} else {
		message.channel.send("You need to enter a valid command!");
	}
});

async function execute(message, serverQueue, lofi=false) {
	const args = message.content.split(" ");
	console.log(args);

	const voiceChannel = lofi?
											client.channels.cache.get("780609058272313405") // 24-hour lofi
										:	message.member.voice.channel;
	
	if (!voiceChannel && !lofi)
		return message.channel.send(
			"You need to be in a voice channel to play music!"
		);

	const permissions =	voiceChannel.permissionsFor(client.user);
	console.log(permissions);
	if (!lofi && (!permissions.has("CONNECT") || !permissions.has("SPEAK"))) {
		return message.channel.send(
			"I need the permissions to join and speak in your voice channel!"
		);
	}

	const songInfo = lofi ? 
									await ytdl.getInfo("https://www.youtube.com/watch?v=5qap5aO4i9A") 
								: await ytdl.getInfo(args[1]);
	const song = {
		title: songInfo.videoDetails.title,
		url: songInfo.videoDetails.video_url,
	};

	const guild = lofi? // get cec guild
								client.guilds.cache.filter(guild => guild.id === "700593210040516608")
							:	message.guild;

	if (!serverQueue) {
		const queueContruct = { // get #spam-central
			textChannel: lofi? client.channels.cache.get("819055884637962241") : message.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};

		

		queue.set(guild.id, queueContruct);

		queueContruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueContruct.connection = connection;

			play(guild, queueContruct.songs[0]);
		} catch (err) {
			console.log(err);
			queue.delete(guild.id);
			return message.channel.send(err);
		}
	} else {
		serverQueue.songs.push(song);
		return message.channel.send(`${song.title} has been added to the queue!`);
	}
}

function skip(message, serverQueue) {
	if (!message.member.voice.channel)
		return message.channel.send(
			"You have to be in a voice channel to stop the music!"
		);
	if (!serverQueue)
		return message.channel.send("There is no song that I could skip!");
	serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
	if (!message.member.voice.channel)
		return message.channel.send(
			"You have to be in a voice channel to stop the music!"
		);
	serverQueue.songs = [];
	serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);
	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}

	const dispatcher = serverQueue.connection
		.play(ytdl(song.url))
		// .play(ytdl("https://www.youtube.com/watch?v=PW0KbfWYwF4"))
		.on("finish", () => {
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on("error", error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
	serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}

client.login(process.env.BOT_TOKEN);