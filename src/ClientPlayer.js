const {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    getVoiceConnection,
    joinVoiceChannel,
    StreamType,
    VoiceConnectionStatus
} = require("@discordjs/voice");
const {
    stream
} = require("play-dl");
const EventEmitter = require("node:events");
const Collection = require("./Collection");

const ytdl = require("ytdl-core");
const scdl = require("soundcloud-downloader").default;
const scrape = require("scrape-youtube").youtube;
const listedSongs = require("./util/listedSpotifySongs");
const fetch = require("node-fetch").default;

const event = new EventEmitter();
const regex = {
    yt: {
        video: /^(https?:\/\/)?(www\.)?(m\.|music\.)?(youtube\.com|youtu\.?be)\/.+$/gi,
        playlist: /^.*(list=)([^#\&\?]*).*/gi
    },
    sp: {
        track: /^https:\/\/open\.spotify\.com\/album\/([a-zA-Z0-9]+)(\?|$)/,
        album: /^https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)(\?|$)/,
        playlist: /^https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)(\?|$)/,
        mobile: /^(https?:\/\/)?(spotify\.)?(link)\/.+$/gi
    },
    sc: {
        track: /^https?:\/\/(soundcloud\.com)\/(.*)$/,
        sets: /^.*\/(sets)\/([^#\&\?]*).*/gi
    }
}

function generateID() {
    let str = "";
    let chars = "ABCDEFGHIJKLMNOPRQSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < 16; i++) {
        str += chars[Math.floor(Math.random()*chars.length)];
    }
    return str;
}

/**
 * 
 * @param {[]} array 
 * @returns 
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
function getSpotifyId(url) {
    const trackRegex = /track\/(\w+)/;
    const playlistRegex = /playlist\/(\w+)/;
    const albumRegex = /album\/(\w+)/;

    if (trackRegex.test(url)) {
        return url.match(trackRegex)[1];
    } else if (playlistRegex.test(url)) {
        return url.match(playlistRegex)[1];
    } else if (albumRegex.test(url)) {
        return url.match(albumRegex)[1];
    } else {
        return null;
    }
}

/**
 * 
 * @param {string} query 
 * @param {{ytKey:string,spotifyCredentials:{clientID:string,clientSecret:string}}} config
 */
async function getInfoTrack(query, config) {
    let { ytKey, spotifyCredentials } = config;
    let track = null;
    let url = query.split(" ")[0];

    let { clientID, clientSecret } = spotifyCredentials;
    let response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            'Authorization': `Basic ${Buffer.from(`${clientID}:${clientSecret}`).toString("base64")}`
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' })
    });
    let { access_token, token_type } = await response.json();

    if(regex.yt.video.test(url)) {
        let trackInfo = await ytdl.getInfo(url);
        track = {
            title: trackInfo.videoDetails.title,
            url: trackInfo.videoDetails.video_url,
            song_id: trackInfo.videoDetails.videoId,
            thumbnail: `https://i.ytimg.com/vi/${trackInfo.videoDetails.videoId}/hqdefault.jpg`,
            duration: parseInt(trackInfo.videoDetails.lengthSeconds)*1000,
            artist: {
                name: trackInfo.videoDetails.author.name,
                url: trackInfo.videoDetails.author.channel_url
            },
            source: "youtube"
        }
    }
    else if(!regex.yt.video.test(url) && regex.yt.playlist.test(url)) {
        let response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?key=${ytKey}&playlistId=${youtube_playlist_parser(query)}&part=snippet&maxResults=10`);
        let data = await response.json();

        let items = [];
        for (let i = 0; i < data.items.length; i++) {
            let track = data.items[i];
            let trackInfo = await ytdl.getInfo(`https://youtube.com/watch?v=${track.snippet.resourceId.videoId}`);
            items.push({
                title: trackInfo.videoDetails.title,
                url: trackInfo.videoDetails.video_url,
                song_id: trackInfo.videoDetails.videoId,
                thumbnail: `https://i.ytimg.com/vi/${trackInfo.videoDetails.videoId}/hqdefault.jpg`,
                duration: parseInt(trackInfo.videoDetails.lengthSeconds)*1000,
                artist: {
                    name: trackInfo.videoDetails.author.name,
                    url: trackInfo.videoDetails.author.channel_url
                },
                source: "youtube"
            });
        }
        track = items;
    }
    else if(regex.sp.track.test(url)) {
        let response = await fetch(`https://api.spotify.com/v1/tracks/${getSpotifyId(url)}`, {
            method: "GET",
            headers: {
                'Authorization': `${token_type} ${access_token}`
            }
        });
        let trackInfo = await response.json();
        let index = listedSongs.map(i => i.id).indexOf(trackInfo.id);

        let youtubeURL;
        if(listedSongs[index]) youtubeURL = listedSongs[index].url;
        else {
            let results = await scrape.search(`${trackInfo.name} - ${trackInfo.artists.map(i => i.name).join(", ")} Topic`);
            youtubeURL = results.videos[0].link;
        }

        track = {
            title: `${trackInfo.name}`,
            url: `https://open.spotify.com/track/${trackInfo.id}`,
            song_id: `${trackInfo.id}`,
            thumbnail: `${trackInfo.album.images.sort((a, b) => b.height - a.height)[0].url}`,
            duration: parseInt(trackInfo.duration_ms),
            artist: [...trackInfo.artists].map(artist => {
                return {
                    name: `${artist.name}`,
                    url: `https://open.spotify.com/artist/${artist.id}`
                }
            }),
            source: "spotify",
            youtube_url: youtubeURL,
        }
    }
    else if(regex.sp.playlist.test(url)) {
        let response = await fetch(`https://api.spotify.com/v1/playlists/${getSpotifyId(url)}`, {
            method: "GET",
            headers: {
                'Authorization': `${token_type} ${access_token}`
            }
        });
        let playlist = await response.json();
        let items = [];
        for (let i = 0; i < playlist.tracks.items.length; i++) {
            let song = playlist.tracks.items[i].track;
            let index = listedSongs.map(i => i.id).indexOf(song.id);

            let youtubeURL;
            if(listedSongs[index]) youtubeURL = listedSongs[index].url;
            else {
                let results = await scrape.search(`${song.name} - ${song.artists.map(i => i.name).join(", ")} Topic`);
                youtubeURL = results.videos[0].link;
            }

            let body = {
                title: `${song.name}`,
                url: `https://open.spotify.com/track/${song.id}`,
                song_id: `${song.id}`,
                thumbnail: `${song.album.images.sort((a, b) => b.height - a.height)[0].url}`,
                duration: parseInt(song.duration_ms),
                artist: [...song.artists].map(artist => {
                    return {
                        name: `${artist.name}`,
                        url: `https://open.spotify.com/artist/${artist.id}`
                    }
                }),
                source: "spotify",
                youtube_url: youtubeURL,
            }
            items.push(body);
        }
        track = items;
    }
    else if(regex.sp.album.test(url)) {
        let response = await fetch(`https://api.spotify.com/v1/albums/${getSpotifyId(url)}`, {
            method: "GET",
            headers: {
                'Authorization': `${token_type} ${access_token}`
            }
        });
        let album = await response.json();
        let items = [];
        for (let i = 0; i < album.tracks.items.length; i++) {
            let song = playlist.tracks.items[i];
            let index = listedSongs.map(i => i.id).indexOf(song.id);

            let youtubeURL;
            if(listedSongs[index]) youtubeURL = listedSongs[index].url;
            else {
                let results = await scrape.search(`${song.name} - ${song.artists.map(i => i.name).join(", ")} Topic`);
                youtubeURL = results.videos[0].link;
            }

            items.push({
                title: `${song.name}`,
                url: `https://open.spotify.com/track/${song.id}`,
                song_id: `${song.id}`,
                thumbnail: `${album.images.sort((a, b) => b.height - a.height)[0].url}`,
                duration: parseInt(song.duration_ms),
                artist: [...song.artists].map(artist => {
                    return {
                        name: `${artist.name}`,
                        url: `https://open.spotify.com/artist/${artist.id}`
                    }
                }),
                source: "spotify",
                youtube_url: youtubeURL,
            });
        }
        track = items;
    }
    else if(regex.sc.track.test(url)) {
        if(regex.sc.sets.test(url)) {
            let sets = await scdl.getSetInfo(url);
            track = sets.tracks.map((song) => {
                return {
                    title: song.title,
                    url: song.permalink_url,
                    song_id: `${song.id}`,
                    thumbnail: song.artwork_url,
                    duration: song.full_duration,
                    artist: song.user ? {
                        name: song.user.username,
                        url: song.user.permalink_url
                    } : null,
                    source: "soundcloud"
                }
            });
        }
        else {
            let trackInfo = await scdl.getInfo(url);
            track = {
                title: trackInfo.title,
                url: trackInfo.permalink_url,
                song_id: `${trackInfo.id}`,
                thumbnail: trackInfo.artwork_url,
                duration: trackInfo.full_duration,
                artist: trackInfo.user ? {
                    name: trackInfo.user.username,
                    url: trackInfo.user.permalink_url
                } : null,
                source: "soundcloud"
            }
        }
    }
    else {
        let results = await scrape.search(query);
        let trackInfo = await ytdl.getInfo(results.videos[0].link);
        track = {
            title: trackInfo.videoDetails.title,
            url: trackInfo.videoDetails.video_url,
            song_id: trackInfo.videoDetails.videoId,
            thumbnail: `https://i.ytimg.com/vi/${trackInfo.videoDetails.videoId}/hqdefault.jpg`,
            duration: parseInt(trackInfo.videoDetails.lengthSeconds)*1000,
            artist: {
                name: trackInfo.videoDetails.author.name,
                url: trackInfo.videoDetails.author.channel_url
            },
            source: "youtube"
        }
    }
    return track;
}

class ClientPlayer {
    /**
     * 
     * @param {import("discord.js").Client} client 
     * @param {{googleKey:string,spotifyCredentials:{clientID:string,clientSecret:string}}} config
     */
    constructor(client, config) {
        this.client = client;
        this.queues = new Collection();
        this.players = new Collection();
        this.config = config;
    }

    /**
     * 
     * @param {import("discord.js").VoiceBasedChannel} voiceChannel 
     */
    createConnection(voiceChannel) {
        return joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator
        });
    }

    /**
     * 
     * @param {string} guildId 
     */
    destroyConnection(guildId) {
        let connection = this.getConnection(guildId);
        if(connection) connection.destroy();
    }

    /**
     * 
     * @param {string} guildId 
     */
    getConnection(guildId) {
        return getVoiceConnection(guildId);
    }

    /**
     * 
     * @param {string} guildId 
     * @returns return as queue or null
     */
    getQueue(guildId) {
        let client = this.client;
        let collection = this.queues;
        let queue = this.queues.get(guildId)
        let player = this.players.get(guildId);
        let connection = this.getConnection(guildId);
        return queue ? {
            id: guildId,
            songs: [...queue.songs].map(song => {
                return {
                    id: `${song.id}`,
                    title: `${song.title}`,
                    url: `${song.url}`,
                    song_id: `${song.song_id}`,
                    position: parseInt(song.position),
                    thumbnail: song.thumbnail ? `${song.thumbnail}` : null,
                    duration: parseInt(song.duration),
                    artist: song.artist ? {
                        name: song.artist.name ? `${song.artist.name}` : null,
                        url: song.artist.name ? `${song.artist.url}` : null
                    } : null,
                    source: `${song.source}`,
                    youtube_url: song.source === "spotify" ? `${song.youtube_url}` : null,
                    user: this.client.users.cache.get(song.user.id),
                    textChannel: this.client.channels.cache.get(song.textChannel.id)
                }
            }),
            loop: queue.loop,
            shuffle: queue.shuffle,
            volume: parseInt(queue.volume),
            position: parseInt(queue.position),
            playing: queue.playing ? true : false,
            connection: connection,
            djUser: queue.djUser ? this.client.users.cache.get(queue.djUser.id) : null,
            votes: [...queue.votes].map(userId => `${userId}`),
            /**
             * @readonly Delete entire queue
             */
            delete() {
                collection.delete(guildId);
            },
            /**
             * 
             * @param {number} position 
             */
            removeSong(position) {
                let currentSong = queue.songs[queue.position];
                this.songs.splice(position - 1, 1);
                queue.songs.splice(position - 1, 1);

                if(queue.shuffle) {
                    let songs = shuffleArray(
                        this.songs.map((song, index) => {
                            song["position"] = index;
                            return song;
                        })
                    );
                    this.songs = songs;
                    queue.songs = songs;
                }
                else {
                    let songs = this.songs.map((song, index) => {
                        song["position"] = index;
                        return song;
                    });
                    this.songs = songs;
                    queue.songs = songs;
                }

                let currentSongIndex = queue.songs.map(i => i.id).indexOf(currentSong.id);
                queue.position = currentSongIndex;
                this.position = currentSongIndex;
                return this;
            },
            /**
             * 
             * @param {number} number 
             */
            setVolume(number) {
                this.volume = number;
                queue.volume = number;
                player.state.resource.volume.setVolume(number / 100);
                return this;
            },
            /**
             * 
             * @param {number} number 
             */
            setLoop(number) {
                this.loop = number;
                queue.loop = number;
                return this;
            },
            /**
             * 
             * @param {import("discord.js").User|string} userOrUserID 
             */
            setDJUser(userOrUserID) {
                let user = userOrUserID ? typeof userOrUserID === "string" ? client.users.cache.get(userOrUserID) : userOrUserID : null;
                this.djUser = user
                queue.djUser = user
                return this;
            },
            previous() {
                if(queue.loop !== 0) {
                    if(queue.position === 0) queue.position = queue.songs.length - 2;
                    else queue.position = queue.position - 2;
                }
                else {
                    if(queue.position === 0) queue.position = -1;
                    else queue.position = queue.position - 2;
                }

                this.position = queue.position;
                player.stop();
                return this;
            },
            skip() {
                player.stop();
                if(this.loop !== 2) {
                    if(this.loop === 1 && this.position === (this.songs.length - 1)) this.position = 0;
                    else this.position++;
                }
                return this;
            },
            pause() {
                queue.playing = false;
                this.playing = false;
                player.pause();
                return this;
            },
            resume() {
                queue.playing = true;
                this.playing = true;
                player.unpause();
                return this;
            },
            leave() {
                connection.destroy();
                this.connection = null;
                this.delete();
            },
            /**
             * 
             * @param {string} userId 
             */
            addVoteToSkip(userId) {
                this.votes.push(userId);
                queue.votes.push(userId);
                return this;
            },
            /**
             * 
             * @param {boolean} trueOrFalse 
             */
            setShuffle(trueOrFalse) {
                let currentSong = queue.songs[queue.position];
                if(trueOrFalse) {
                    let songs = shuffleArray(queue.songs);
                    queue.songs = songs;
                    this.songs = songs;
                }
                else {
                    let songs = queue.songs.sort((a, b) => a.position - b.position);
                    queue.songs = songs;
                    this.songs = songs;
                }
                let currentSongIndex = queue.songs.map(i => i.id).indexOf(currentSong.id);
                this.position = currentSongIndex;
                queue.position = currentSongIndex;

                this.shuffle = trueOrFalse;
                queue.shuffle = trueOrFalse;
                return this;
            }
        } : null
    }
    /**
     * 
     * @param {"addSong"|"playSong"|"finishSong"|"finishQueue"} Events 
     * @param {Function} callback 
     */
    on(Events, callback) {
        event
            .on("playSong", (data) => {
                let { guildId, song } = data;
                let queue = this.getQueue(guildId);
                if(Events === "playSong") callback(queue, song);
            })
            .on("addSong", (data) => {
                let { guildId, song } = data;
                let queue = this.getQueue(guildId);
                if(Events === "addSong") callback(queue, song);
            })
            .on("finishSong", async(data) => {
                let { guildId, song } = data;
                let queue = this.getQueue(guildId);

                if(Events === "finishSong") callback(queue, song);
                if(!queue || queue.position > (queue.songs.length - 1)) event.emit("finishQueue", queue);
                else {
                    const playTrack = async() => {
                        let nextSong = queue.songs[queue.position];
                        let player = this.players.get(guildId);
                        
                        let strm = null;
                        try {
                            if(nextSong.source === "spotify" || nextSong.source === "youtube") strm = await stream(nextSong.source === "spotify" ? nextSong.youtube_url : nextSong.url);
                            else strm = { stream: await scdl.downloadFormat(nextSong.url, scdl.FORMATS.MP3), type: StreamType.Arbitrary };
                        } catch (error) {
                            console.log(error);
                        }
                        if(!strm) {
                            setTimeout(playTrack, 2500);
                            return;
                        }

                        const resource = createAudioResource(strm.stream, { inlineVolume: true, inputType: strm.type });
                        resource.volume.setVolume(queue.volume / 100);
                        player.play(resource);
                    }
                    playTrack();
                }
            })
            .on("finishQueue", (queue) => {
                if(queue) this.queues.delete(queue.id);
                if(Events === "finishQueue") callback(queue);
            });
        return this;
    }

    /**
     * 
     * @param {string} query 
     * @param {{textChannel:import("discord.js").TextBasedChannel,voiceChannel:import("discord.js").VoiceBasedChannel,user:import("discord.js").User}} config 
     */
    async play(query, config) {
        let { textChannel, voiceChannel, user } = config;
        let connection = this.getConnection(textChannel.guildId);

        let player = this.players.get(textChannel.guildId);
        let queue = this.queues.get(textChannel.guildId);
        let queueConstruct = {
            id: textChannel.guildId,
            songs: [],
            votes: [],
            loop: 0,
            volume: 100,
            shuffle: false,
            position: 0,
            djUser: user,
            playing: true,
        }

        let video = null;
        try {
            video = await getInfoTrack(query, {
                ytKey: this.config.googleKey,
                spotifyCredentials: this.config.spotifyCredentials
            });
            if(Array.isArray(video)) video = video.map(song => {
                song["id"] = generateID();
                song["user"] = user;
                song["textChannel"] = textChannel;
                return song;
            });
            else {
                video["id"] = generateID();
                video["user"] = user;
                video["textChannel"] = textChannel;
            }
        } catch (error) {
            console.log(error);
        }
        if(!video) return new Error("Cannot find video!");

        if(Array.isArray(video)) {
            for (let i = 0; i < video.length; i++) {
                video[i]["position"] = queue ? queue.songs.length : queueConstruct.songs.length;
                if(queue) queue.songs.push(video[i]);
                else queueConstruct.songs.push(video[i]);
            }
        }
        else {
            video["position"] = queue ? queue.songs.length : queueConstruct.songs.length;
            if(queue) queue.songs.push(video);
            else queueConstruct.songs.push(video);
        }

        if(!player) {
            player = createAudioPlayer()
                .on(AudioPlayerStatus.Playing, () => {
                    let queue = this.queues.get(textChannel.guildId);
                    if(!queue) return;

                    let song = queue.songs[queue.position];
                    event.emit("playSong", { guildId: textChannel.guildId, song });
                })
                .on(AudioPlayerStatus.Idle, () => {
                    let queue = this.queues.get(textChannel.guildId);
                    if(!queue) return;

                    queue.votes = [];
                    let song = queue.songs[queue.position];
                    if(queue.loop !== 2) {
                        if(queue.loop === 1 && queue.position === (queue.songs.length - 1)) queue.position = 0;
                        else queue.position++;
                    }
                    event.emit("finishSong", { guildId: textChannel.guildId, song });
                });
            this.players.set(textChannel.guildId, player);
        }
        if(queue) {
            if(Array.isArray(video)) event.emit("addList", { guildId: textChannel.guildId, songs: video });
            else event.emit("addSong", { guildId: textChannel.guildId, song: video })
        }
        else {
            if(!connection) {
                connection = joinVoiceChannel({
                    guildId: textChannel.guildId,
                    channelId: voiceChannel.id,
                    adapterCreator: textChannel.guild.voiceAdapterCreator
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

            let strm = null;
            let position = queue ? queue.position : queueConstruct.position;
            if((Array.isArray(video) && (video[position].source === "youtube" || video[position].source === "spotify")) || (video.source === "youtube" || video.source === "spotify")) {
                strm = await stream(Array.isArray(video)
                    ? video[position].source === "spotify" ? video[position].youtube_url : video[position].url
                    : video.source === "spotify" ? video.youtube_url : video.url
                );
            }
            else strm = { stream: await scdl.downloadFormat(Array.isArray(video) ? video[position].url : video.url, scdl.FORMATS.MP3), type: StreamType.Arbitrary };
            this.queues.set(textChannel.guildId, queueConstruct);

            const resource = createAudioResource(strm.stream, { inlineVolume: true, inputType: strm.type });
            resource.volume.setVolume(queue ? queue.volume / 100 : queueConstruct.volume / 100);
            player.play(resource);

            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            connection.subscribe(player);
        }
    }
}

module.exports = ClientPlayer