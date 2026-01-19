import express from 'express';
import multer from 'multer';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const PORT = 3001;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json());

// Create uploads and output directories
const uploadsDir = path.join(__dirname, 'temp-uploads');
const outputsDir = path.join(__dirname, 'converted-audio');
const recordingsDir = path.join(__dirname, 'recordings');
const backgroundAudioDir = path.join(recordingsDir, 'background-audio');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
  // Create subdirectories for different recording types
  fs.mkdirSync(path.join(recordingsDir, 'voice-samples'), { recursive: true });
  fs.mkdirSync(backgroundAudioDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Audio conversion server running' });
});

// Convert audio endpoint
app.post('/convert', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { format, outputPath } = req.body;
  const inputPath = req.file.path;
  const outputFormat = format || 'wav';

  // Generate output filename
  const outputFilename = path.basename(req.file.originalname, path.extname(req.file.originalname)) + '.' + outputFormat;
  const serverOutputPath = path.join(outputsDir, outputFilename);

  try {
    await new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath);

      // Configure based on output format
      if (outputFormat === 'wav') {
        command
          .audioCodec('pcm_s16le')
          .audioChannels(2)
          .audioFrequency(44100);
      } else if (outputFormat === 'ogg') {
        command
          .audioCodec('libvorbis')
          .audioBitrate('192k');
      } else if (outputFormat === 'mp3') {
        command
          .audioCodec('libmp3lame')
          .audioBitrate('192k');
      }

      command
        .on('start', (commandLine) => {
          console.log('FFmpeg started:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + (progress.percent || 0).toFixed(2) + '% done');
        })
        .on('end', () => {
          console.log('Conversion finished:', outputFilename);
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .save(serverOutputPath);
    });

    // If user specified an output path, copy the file there
    if (outputPath) {
      const userOutputPath = path.resolve(outputPath, outputFilename);
      fs.copyFileSync(serverOutputPath, userOutputPath);
      console.log('File saved to:', userOutputPath);
    }

    // Get file stats
    const stats = fs.statSync(serverOutputPath);

    // Clean up input file
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      filename: outputFilename,
      size: stats.size,
      format: outputFormat,
      serverPath: serverOutputPath,
      userPath: outputPath ? path.resolve(outputPath, outputFilename) : null
    });

  } catch (error) {
    // Clean up files on error
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    if (fs.existsSync(serverOutputPath)) {
      fs.unlinkSync(serverOutputPath);
    }

    console.error('Conversion error:', error);
    res.status(500).json({
      error: 'Conversion failed',
      message: error.message
    });
  }
});

// Download converted file
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(outputsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Download failed' });
    }
  });
});

// Get info about an audio file
app.post('/info', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;

  try {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      // Clean up uploaded file
      fs.unlinkSync(inputPath);

      if (err) {
        return res.status(500).json({ error: 'Failed to get file info', message: err.message });
      }

      res.json({
        format: metadata.format,
        streams: metadata.streams,
        duration: metadata.format.duration,
        size: metadata.format.size,
        bitrate: metadata.format.bit_rate
      });
    });
  } catch (error) {
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    res.status(500).json({ error: 'Failed to process file', message: error.message });
  }
});

// Save recording to local filesystem
app.post('/save-recording', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { directory, filename, format } = req.body;
  const inputPath = req.file.path;
  const outputFormat = format || 'wav';

  // Use default recordings directory if not specified
  const targetDir = directory
    ? path.resolve(directory)
    : recordingsDir;

  // Create directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (err) {
      fs.unlinkSync(inputPath);
      return res.status(500).json({ error: 'Failed to create directory', message: err.message });
    }
  }

  const outputFilename = filename || `recording-${Date.now()}.${outputFormat}`;
  const outputPath = path.join(targetDir, outputFilename);

  try {
    await new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath);

      // Configure based on format
      if (outputFormat === 'wav') {
        command
          .audioCodec('pcm_s16le')
          .audioChannels(2)
          .audioFrequency(44100);
      } else if (outputFormat === 'ogg') {
        command
          .audioCodec('libvorbis')
          .audioBitrate('192k');
      } else if (outputFormat === 'mp3') {
        command
          .audioCodec('libmp3lame')
          .audioBitrate('192k');
      }

      command
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputPath);
    });

    const stats = fs.statSync(outputPath);
    fs.unlinkSync(inputPath); // Clean up temp file

    res.json({
      success: true,
      path: outputPath,
      filename: outputFilename,
      size: stats.size,
      format: outputFormat,
      directory: targetDir
    });

  } catch (error) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    res.status(500).json({
      error: 'Save failed',
      message: error.message
    });
  }
});

// Get default recording directory
app.get('/recording-directory', (req, res) => {
  res.json({
    directory: recordingsDir,
    exists: fs.existsSync(recordingsDir)
  });
});

// Set custom recording directory
app.post('/recording-directory', (req, res) => {
  const { directory } = req.body;

  if (!directory) {
    return res.status(400).json({ error: 'Directory path required' });
  }

  try {
    const resolvedPath = path.resolve(directory);

    // Create if doesn't exist
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }

    res.json({
      success: true,
      directory: resolvedPath,
      exists: true
    });
  } catch (error) {
    res.status(500).json({
      error: 'Invalid directory',
      message: error.message
    });
  }
});

// Analyze audio quality metrics
app.post('/analyze-audio', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;

  try {
    const analysis = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        // Extract audio stream
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        if (!audioStream) {
          reject(new Error('No audio stream found'));
          return;
        }

        // Run volume detection analysis
        let volumeStats = null;

        ffmpeg(inputPath)
          .audioFilters('volumedetect')
          .format('null')
          .on('stderr', (stderrLine) => {
            // Parse volume detection output
            const maxVolMatch = stderrLine.match(/max_volume:\s*([-\d.]+)\s*dB/);
            const meanVolMatch = stderrLine.match(/mean_volume:\s*([-\d.]+)\s*dB/);

            if (maxVolMatch || meanVolMatch) {
              volumeStats = volumeStats || {};
              if (maxVolMatch) volumeStats.max_volume = parseFloat(maxVolMatch[1]);
              if (meanVolMatch) volumeStats.mean_volume = parseFloat(meanVolMatch[1]);
            }
          })
          .on('end', () => {
            resolve({
              codec: audioStream.codec_name,
              sample_rate: audioStream.sample_rate,
              channels: audioStream.channels,
              bit_rate: audioStream.bit_rate || metadata.format.bit_rate,
              duration: metadata.format.duration,
              volume_stats: volumeStats || {}
            });
          })
          .on('error', reject)
          .output('-')
          .run();
      });
    });

    fs.unlinkSync(inputPath); // Clean up

    // Calculate quality metrics
    const qualityMetrics = {
      sample_rate_quality: analysis.sample_rate >= 44100 ? 'good' : 'low',
      bit_depth_quality: analysis.codec.includes('pcm_s16') || analysis.codec.includes('pcm_s24') ? 'good' : 'compressed',
      clipping_detected: analysis.volume_stats.max_volume && analysis.volume_stats.max_volume > -0.5,
      noise_floor: analysis.volume_stats.mean_volume || 0,
      peak_level: analysis.volume_stats.max_volume || 0,
      dynamic_range: analysis.volume_stats.max_volume && analysis.volume_stats.mean_volume
        ? (analysis.volume_stats.max_volume - analysis.volume_stats.mean_volume)
        : 0,
      overall_quality: 'calculating...'
    };

    // Overall quality assessment
    let qualityScore = 0;
    if (qualityMetrics.sample_rate_quality === 'good') qualityScore += 30;
    if (!qualityMetrics.clipping_detected) qualityScore += 30;
    if (analysis.volume_stats.mean_volume && analysis.volume_stats.mean_volume > -30) qualityScore += 20;
    if (qualityMetrics.dynamic_range > 10) qualityScore += 20;

    qualityMetrics.overall_quality =
      qualityScore >= 80 ? 'excellent' :
      qualityScore >= 60 ? 'good' :
      qualityScore >= 40 ? 'fair' : 'poor';

    res.json({
      ...analysis,
      quality_metrics: qualityMetrics
    });

  } catch (error) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    });
  }
});

// ===== BACKGROUND AUDIO STORAGE ENDPOINTS =====

// Save background audio to local filesystem
app.post('/background-audio/save', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { filename, customDirectory } = req.body;
  const inputPath = req.file.path;

  // Use custom directory or default background audio directory
  const targetDir = customDirectory
    ? path.resolve(customDirectory)
    : backgroundAudioDir;

  // Create directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (err) {
      fs.unlinkSync(inputPath);
      return res.status(500).json({ error: 'Failed to create directory', message: err.message });
    }
  }

  const outputFilename = filename || `background-${Date.now()}.wav`;
  const outputPath = path.join(targetDir, outputFilename);

  try {
    // Convert to WAV for consistent storage
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('pcm_s16le')
        .audioChannels(2)
        .audioFrequency(44100)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputPath);
    });

    const stats = fs.statSync(outputPath);
    fs.unlinkSync(inputPath); // Clean up temp file

    res.json({
      success: true,
      path: outputPath,
      filename: outputFilename,
      size: stats.size,
      directory: targetDir
    });

  } catch (error) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    res.status(500).json({
      error: 'Save failed',
      message: error.message
    });
  }
});

// List background audio files from filesystem
app.get('/background-audio/list', (req, res) => {
  const { directory } = req.query;
  const targetDir = directory ? path.resolve(directory) : backgroundAudioDir;

  if (!fs.existsSync(targetDir)) {
    return res.json({
      files: [],
      directory: targetDir,
      exists: false
    });
  }

  try {
    const files = fs.readdirSync(targetDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.wav', '.mp3', '.ogg', '.m4a', '.flac', '.aac'].includes(ext);
      })
      .map(file => {
        const filePath = path.join(targetDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtimeMs,
          created: stats.birthtimeMs
        };
      })
      .sort((a, b) => b.modified - a.modified); // Newest first

    res.json({
      files,
      directory: targetDir,
      exists: true,
      count: files.length
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to list files',
      message: error.message,
      directory: targetDir
    });
  }
});

// Load background audio file from filesystem
app.get('/background-audio/load/:filename', (req, res) => {
  const { filename } = req.params;
  const { directory } = req.query;

  const targetDir = directory ? path.resolve(directory) : backgroundAudioDir;
  const filePath = path.join(targetDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found', path: filePath });
  }

  // Stream the file to the client
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Failed to send file:', err);
      res.status(500).json({ error: 'Failed to load file' });
    }
  });
});

// Delete background audio file from filesystem
app.delete('/background-audio/delete/:filename', (req, res) => {
  const { filename } = req.params;
  const { directory } = req.query;

  const targetDir = directory ? path.resolve(directory) : backgroundAudioDir;
  const filePath = path.join(targetDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({
      success: true,
      message: 'File deleted',
      filename
    });
  } catch (error) {
    res.status(500).json({
      error: 'Delete failed',
      message: error.message
    });
  }
});

// Get background audio directory path
app.get('/background-audio/directory', (req, res) => {
  res.json({
    directory: backgroundAudioDir,
    exists: fs.existsSync(backgroundAudioDir),
    absolutePath: path.resolve(backgroundAudioDir)
  });
});

// Set custom background audio directory
app.post('/background-audio/directory', (req, res) => {
  const { directory } = req.body;

  if (!directory) {
    return res.status(400).json({ error: 'Directory path required' });
  }

  try {
    const resolvedPath = path.resolve(directory);

    // Create if doesn't exist
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }

    // List files in the directory to verify it's accessible
    const files = fs.readdirSync(resolvedPath)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.wav', '.mp3', '.ogg', '.m4a', '.flac', '.aac'].includes(ext);
      });

    res.json({
      success: true,
      directory: resolvedPath,
      exists: true,
      fileCount: files.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Invalid directory',
      message: error.message
    });
  }
});

// Clean up old files (runs every hour)
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour

  [uploadsDir, outputsDir].forEach(dir => {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up old file:', file);
      }
    });
  });
}, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Audio conversion server running on http://localhost:${PORT}`);
  console.log(`Output directory: ${outputsDir}`);
  console.log(`Background audio directory: ${backgroundAudioDir}`);
});
