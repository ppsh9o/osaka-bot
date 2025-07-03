// index.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Bot client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Bot responses
const responses = {
    'osaka': {
        type: 'text',
        content: []
    },
    // Media
    'elded': {
        type: 'random',
        files: []
    },
};

// Download file from Discord URL
function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https:') ? https : http;
        const file = fs.createWriteStream(filepath);
        
        protocol.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {}); // Delete the file on error
            reject(err);
        });
    });
}

// Get next available filename
function getNextFilename(directory, extension) {
    const files = fs.readdirSync(directory);
    
    // Naming and ordering files
    const filePrefix = directory.includes('images') ? 'image' : 'video';
    
    const existingNumbers = files
        .filter(file => file.startsWith(filePrefix))
        .map(file => {
            const match = file.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
        })
        .sort((a, b) => b - a);
    
    const nextNumber = existingNumbers.length > 0 ? existingNumbers[0] + 1 : 1;
    return `${filePrefix}${nextNumber}${extension}`;
}

// Get file extension from content type
function getExtensionFromContentType(contentType) {
    const extensions = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/quicktime': '.mov',
        'video/x-msvideo': '.avi'
    };
    return extensions[contentType] || '.bin';
}

// Refresh file lists
function refreshFileLists() {
    try {
        // Refresh images
        const imageFiles = fs.readdirSync('./images')
            .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
            .map(file => `./images/${file}`);
        
        // Refresh videos
        const videoFiles = fs.readdirSync('./videos')
            .filter(file => /\.(mp4|webm|mov|avi)$/i.test(file))
            .map(file => `./videos/${file}`);
        
        // Update elded files list
        responses.elded.files = [...imageFiles, ...videoFiles];
        
        console.log(`refreshed file lists: ${imageFiles.length} images, ${videoFiles.length} videos`);
    } catch (error) {
        console.error('error refreshing file lists:', error);
    }
}

// When bot is ready
client.once('ready', () => {
    console.log(`bot is online as ${client.user.tag}!`);
    
    // Ensure directories exist
    if (!fs.existsSync('./images')) fs.mkdirSync('./images');
    if (!fs.existsSync('./videos')) fs.mkdirSync('./videos');
    
    // Refresh file lists on startup
    refreshFileLists();
});

// Listen for messages
client.on('messageCreate', async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;
   
    // Convert message to lowercase for checking
    const messageContent = message.content.toLowerCase();
    
    // Handle upload command
    if (messageContent.startsWith('!upload') && message.attachments.size > 0) {
        try {
            let uploadedCount = 0;
            
            for (const attachment of message.attachments.values()) {
                const contentType = attachment.contentType;
                
                // Check if it's an image or video
                if (contentType && (contentType.startsWith('image/') || contentType.startsWith('video/'))) {
                    const extension = getExtensionFromContentType(contentType);
                    const isVideo = contentType.startsWith('video/');
                    const directory = isVideo ? './videos' : './images';
                    
                    // Generate filename
                    const filename = getNextFilename(directory, extension);
                    const filepath = path.join(directory, filename);
                    
                    // Download the file
                    await downloadFile(attachment.url, filepath);
                    uploadedCount++;
                    
                    console.log(`uploaded ${filename} by ${message.author.tag}`);
                } else {
                    console.log(`skipped non-media file: ${attachment.name}`);
                }
            }
            
            if (uploadedCount > 0) {
                // Refresh file lists after upload
                refreshFileLists();
                
                await message.reply(`you have uploaded ${uploadedCount} file!`);
            } else {
                await message.reply('file not uploaded');
            }
            
        } catch (error) {
            console.error('error uploading files:', error);
            await message.reply('error uploading files. try again.');
        }
        return; // Don't process other commands
    }
    
    // Handle refresh command
    if (messageContent === '!refresh') {
        refreshFileLists();
        await message.reply('file lists refreshed!');
        return;
    }
   
    // Check each trigger word
    for (const [trigger, response] of Object.entries(responses)) {
        if (messageContent.includes(trigger)) {
            try {
                if (response.type === 'random') {
                    // Handle file responses
                    if (!response.files || response.files.length === 0) {
                        console.error(`no files defined for trigger: ${trigger}`);
                        continue;
                    }
                    const randomFile = response.files[Math.floor(Math.random() * response.files.length)];
                    await message.channel.send({
                        content: response.content,
                        files: [randomFile]
                    });
                } else if (response.type === 'text') {
                    // Handle text-only responses
                    const randomText = response.content[Math.floor(Math.random() * response.content.length)];
                    await message.channel.send(randomText);
                }
                break;
            } catch (error) {
                console.error('error sending response:', error);
            }
        }
    }
});

// Error handling
client.on('error', console.error);

// Login to Discord
client.login(process.env.DISCORD_TOKEN);