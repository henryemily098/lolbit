const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const { Spotify } = require("spotify-info.js");
const { EmbedBuilder } = require("discord.js");
const { search } = require("scrape-youtube");
const { play } = require("../src");

const ytdl = require("ytdl-core");
const scdl = require("soundcloud-downloader").default;
const fetch = require("node-fetch").default;
const spotify = new Spotify({
    clientID: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

let options = [
    {
        name: "query",
        type: 3,
        required: true,
        description: "Input an url or title of the song to search!"
    }
]

module.exports = {
    data: [
        {
            name: "p",
            description: "Playing song. Support youtube, soundcloud, and spotify.",
            options: options
        },
        {
            name: "play",
            description: "Playing song. Support youtube, soundcloud, and spotify.",
            options: options
        }
    ],
    /**
     * 
     * @param {import("discord.js").CommandInteraction} interaction 
     * @param {import("../src").Client} client 
     */
    async run(interaction, client) {

        const { channel } = interaction.member.voice;
        if(!channel) return interaction.reply({ content: "You have to join voice channel first1", ephemeral: true }).catch(console.log);

        let connection = getVoiceConnection(interaction.guild.id);
        if(connection && connection.joinConfig.channelId !== channel.id) return interaction.reply({ content: `You need to join <#${connection.joinConfig.channelId}> first!`, ephemeral: true }).catch(console.log);
        else {
            connection = joinVoiceChannel({
                guildId: interaction.guild.id,
                channelId: channel.id,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });

            connection.on("stateChange", (oldState, newState) => {
                const oldNetworking = Reflect.get(oldState, 'networking');
                const newNetworking = Reflect.get(newState, 'networking');
              
                const networkStateChangeHandler = (oldNetworkState, newNetworkState) => {
                  const newUdp = Reflect.get(newNetworkState, 'udp');
                  clearInterval(newUdp?.keepAliveInterval);
                }
              
                oldNetworking?.off('stateChange', networkStateChangeHandler);
                newNetworking?.on('stateChange', networkStateChangeHandler);
            });
        }

        let song = null;
        let songs = [];
        
        let query = interaction.options.get("query", true)?.value;
        let url = query.split(" ")[0];
        let check = checkUrl(url);

        try {

            if(check) {

                if(check.platform === "soundcloud") {
                    if(check.type === "track") {
                        let songInfo = await scdl.getInfo(url);
                        song = {
                            title: songInfo.title,
                            url: songInfo.permalink_url,
                            id: `${songInfo.id}`,
                            thumbnails: songInfo.artwork_url ? [
                                {
                                    height: 450,
                                    width: 450,
                                    url: songInfo.artwork_url
                                }
                            ] : [],
                            author: songInfo.user,
                            duration: songInfo.full_duration,
                        }
                    } else {
                        let playlist = await scdl.getSetInfo(url);
                        songs = playlist.tracks.map(songInfo => {
                            return {
                                title: songInfo.title,
                                url: songInfo.permalink_url,
                                id: `${songInfo.id}`,
                                thumbnails: songInfo.artwork_url ? [
                                    {
                                        height: 450,
                                        width: 450,
                                        url: songInfo.artwork_url
                                    }
                                ] : [],
                                author: songInfo.user,
                                duration: songInfo.full_duration,
                            }
                        });
                    }
                }
                else if(check.platform === "spotify") {
                    if(check.type === "track") {
                        let songInfo = await spotify.getTrackByURL(url);
                        song = {
                            title: `${songInfo.name}`,
                            url: `https://open.spotify.com/track/${songInfo.id}`,
                            id: songInfo.id,
                            thumbnails: songInfo.album.images,
                            artists: songInfo.artists,
                            duration: parseInt(songInfo.duration_ms)
                        }
                    }
                    else {
                        let playlist = null;
                        if(check.type === "album") playlist = await spotify.getAlbumByURL(url);
                        else if(check.type === "playlist") playlist = await spotify.getPlaylistByURL(url);

                        songs = playlist.tracks.items.map((item) => {
                            if(check.type === "playlist") trackInfo = item.track;
                            if(check.type === "album") trackInfo = item;
                    
                            return {
                                title: `${trackInfo.name}`,
                                url: `https://open.spotify.com/track/${trackInfo.id}`,
                                id: `${trackInfo.id}`,
                                thumbnails: check.type === "playlist" ? trackInfo.album.images : playlist.images,
                                duration: parseInt(trackInfo.duration_ms),
                                artists: trackInfo.artists
                            }
                        });
                    }
                }
                else if(check.platform === "youtube") {

                    if(check.type === "playlist") songs = await getPlaylist(url);
                    else {
                        let songInfo = await ytdl.getInfo(url);
                        song = {
                            title: songInfo.videoDetails.title,
                            url: songInfo.videoDetails.video_url,
                            id: songInfo.videoDetails.videoId,
                            thumbnails: songInfo.videoDetails.thumbnails,
                            author: songInfo.videoDetails.author,
                            duration: songInfo.videoDetails.lengthSeconds*1000
                        };
                    }

                }

            } else {
                let results = await search(query).then(res => res.videos);
                let songInfo = await ytdl.getInfo(results[0].link);
                song = {
                    title: songInfo.videoDetails.title,
                    url: songInfo.videoDetails.video_url,
                    id: songInfo.videoDetails.videoId,
                    thumbnails: songInfo.videoDetails.thumbnails,
                    author: songInfo.videoDetails.author,
                    duration: songInfo.videoDetails.lengthSeconds*1000
                };
            }
            
        } catch (error) {
            console.log(error);
            return interaction.reply({ content: "There's something error while fetching track information!", ephemeral: true }).catch(console.log);
        }

        const serverQueue = client.queue.get(interaction.guild.id);
        const queueConstruct = {
            songs: [],
            votes: [],
            loop: 0,
            player: null,
            control: null,
            message: null,
            dj_user: interaction.user,
            playing: true,
            index: 0,
            volume: 100
        }

        let embed = new EmbedBuilder().setColor(client.config.defaultColor);
        if(song) {
            song['textChannel'] = interaction.channel;
            song['requestedUser'] = interaction.user;
            song['type'] = check ? check.platform : 'youtube';
            embed
                .setAuthor({ name: "| Added To Queue", iconURL: client.user.displayAvatarURL({ extension: "png", size: 1024, forceStatic: true }) })
                .setDescription(`[${song.title}](${song.url})`)
                .setThumbnail(`https://i.ytimg.com/vi/${song.id}/hqdefault.jpg`)
                .setFooter({ text: `Requested by ${interaction.user.tag}` });
        }
        else if(songs.length) {
            for (let i = 0; i < songs.length; i++) {
                let track = songs[i];
                track['textChannel'] = interaction.channel;
                track['requestedUser'] = interaction.user;
                track['type'] = check ? check.platform : 'youtube';
            }
            embed.setAuthor({ name: `| Added ${songs.length} Songs To Queue`, iconURL: client.user.displayAvatarURL({ extension: "png", size: 1024, forceStatic: true }) })
        }

        if(serverQueue) {
            if(song) serverQueue.songs.push(song);
            else if(songs.length) {
                for (let i = 0; i < songs.length; i++) {
                    serverQueue.songs.push(songs[i]);
                }
            }
        } else {
            if(song) queueConstruct.songs.push(song);
            else if(songs.length) {
                for (let i = 0; i < songs.length; i++) {
                    queueConstruct.songs.push(songs[i]);
                }
            }
        }

        interaction
            .reply({ embeds: [embed] })
            .catch(console.log);
        
        if(!serverQueue) client.queue.set(interaction.guild.id, queueConstruct);
        if(!serverQueue) {
            try {
                await play(queueConstruct.songs[0], interaction.guild.id, client);
            } catch (error) {
                console.log(error);
                connection.destroy();
                client.queue.delete(interaction.guild.id);
                return interaction.channel
                    .send({ content: "There's something error with the player! Please try again!" })
                    .then(msg => setTimeout(() => msg.delete().catch(console.log), 5000))
                    .catch(console.log);
            }
        }

    }
}

function checkUrl(url) {
    let regex = {
        url: /^(ftp|http|https):\/\/[^ "]+$/,
        youtube: {
            video: /^(https?:\/\/)?(www\.)?(m\.|music\.)?(youtube\.com|youtu\.?be)\/.+$/gi,
            playlist: /^.*(list=)([^#\&\?]*).*/gi
        },
        spotify: {
            track: /^(https?:\/\/)?(open\.)?(spotify\.com)\/(track)\/.+$/gi,
            album: /^(https?:\/\/)?(open\.)?(spotify\.com)\/(album)\/.+$/gi,
            playlist: /^(https?:\/\/)?(open\.)?(spotify\.com)\/(playlist)\/.+$/gi
        },
        soundcloud: {
            track: /^https?:\/\/(soundcloud\.com)\/(.*)$/,
            sets: /^.*\/(sets)\/([^#\&\?]*).*/gi
        }
    }

    let data = null;
    if(regex.url.test(url)) {
        if(regex.youtube.video.test(url)) data = { isValid: true, type: "video", platform: "youtube" };
        if(!regex.youtube.video.test(url) && regex.youtube.playlist.test(url)) data = { isValid: true, type: "playlist", platform: "youtube" };

        if(regex.spotify.track.test(url)) data = { isValid: true, type: "track", platform: "spotify" };
        if(regex.spotify.album.test(url)) data = { isValid: true, type: "album", platform: "spotify" };
        if(regex.spotify.playlist.test(url)) data = { isValid: true, type: "playlist", platform: "spotify" };
    
        if(regex.soundcloud.track.test(url)) {
            if(regex.soundcloud.sets.test(url)) data = { isValid: true, type: "playlist", platform: "soundcloud" };
            else data = { isValid: true, type: "track", platform: "soundcloud" };
        }
    }

    return data;
}

/**
 * @param {string} url 
 */
async function getPlaylist(url) {
    let response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?key=${process.env.YT_KEY}&playlistId=${youtube_playlist_parser(url)}&part=snippet&maxResults=10`)
        .then(res => res.json())
        .then(res => res.items);
    
    let items = [];
    for (let i = 0; i < response.length; i++) {
        let track = response[i];
        let songInfo = await ytdl.getInfo(`https://youtube.com/watch?v=${track.snippet.resourceId.videoId}`);
        items.push({
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
            id: songInfo.videoDetails.videoId,
            thumbnails: songInfo.videoDetails.thumbnails,
            author: songInfo.videoDetails.author,
            duration: songInfo.videoDetails.lengthSeconds*1000
        });
    }

    return items;
}

/**
 * 
 * @param {string} url 
 * @returns 
 */
function youtube_playlist_parser(url){

    var reg = new RegExp("[&?]list=([a-z0-9_]+)","i");
    var match = reg.exec(url);

    if (match&&match[1].length>0&&youtube_validate(url)){
        return match[1];
    }else{
        return "";
    }

}

/**
 * 
 * @param {string} url 
 * @returns 
 */
function youtube_validate(url) {

    var regExp = /^(?:https?:\/\/)?(?:www\.)?youtube\.com(?:\S+)?$/;
    return url.match(regExp)&&url.match(regExp).length>0;

}