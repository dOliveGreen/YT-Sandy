import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Loader2, Search, ArrowDownToLine, FileSpreadsheet } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { LANDING_URL } from '@/lib/links';

const Header = () => {
  const { url, urlInputRef, handleUrlChange, handleFetchDetails, isLoading, activeJobs, isDownloading, goBackToHistory, jobResults } = useAppContext();
  const [urlFocused, setUrlFocused] = useState(false);
  const [archiveRows, setArchiveRows] = useState([]);
  const [archiveRunning, setArchiveRunning] = useState(false);
  const [archiveProgress, setArchiveProgress] = useState(null);
  const archiveRowsRef = useRef([]);
  const archiveTargetDirRef = useRef(null);
  const archiveJobRef = useRef(null);

  const handleImportSpreadsheet = async () => {
    const result = await window.electronAPI.chooseArchiveSpreadsheet();

    if (!result) return;

    if (!result.success) {
      alert(`Could not read spreadsheet:\n${result.error}`);
      return;
    }

    alert(
      `Spreadsheet loaded successfully!\n\n` +
      `Sheet: ${result.sheetName}\n` +
      `Rows: ${result.rowCount}`
    );

    setArchiveRows(result.rows);
    archiveRowsRef.current = result.rows;

    const savedProgress = await window.electronAPI.getArchiveProgress();
    setArchiveProgress(savedProgress);

    console.log("Archive spreadsheet:", result);
  };

  const queueArchiveAttempt = async ({ info, title, videoUrl, targetDir, formats, formatIndex }) => {
    const format = formats[formatIndex];

    const res = await window.electronAPI.queuePlaylist({
      title,
      uploader: info.uploader || "",
      url: "",
      targetDir,
      allowDuplicates: true,
      numberItems: false,
      formatLabel: format.quality || `${format.height || "Best"}p`,
      thumbnailUrl: info.thumbnailUrl || "",
      items: [{
        id: info.videoId,
        playlistIndex: 1,
        url: info.webpageUrl || videoUrl,
        title,
        thumbnail: info.thumbnailUrl || "",
        duration: info.duration || 0,
        type: "mp4",
        quality: String(format.itag),
        qualityLabel: format.quality || "Best",
        convertToH264: false,
        sizeBytes: format.size || 0,
      }],
    });

    if (!res.success) {
      throw new Error(res.error || "Could not queue archive video.");
    }

    archiveJobRef.current = {
      jobId: res.jobId,
      url: videoUrl,
      title,
      info,
      formats,
      formatIndex,
      targetDir,
    };
  };

  const queueNextArchiveVideo = async (rows, completedUrls, targetDir) => {
    const MIN_FREE_GB = 20;

    const disk = await window.electronAPI.getFreeDiskSpace(targetDir);

    if (!disk.success) {
      setArchiveRunning(false);
      alert(
        `Archive stopped because free disk space could not be checked.\n\n` +
        `${disk.error}`
      );
      return;
    }

    if (disk.freeGB < MIN_FREE_GB) {
      setArchiveRunning(false);
      archiveJobRef.current = null;

      alert(
        `Archive paused — disk space is getting low.\n\n` +
        `Free space: ${disk.freeGB.toFixed(1)} GB\n` +
        `Minimum reserve: ${MIN_FREE_GB} GB\n\n` +
        `Let OneDrive finish syncing, use "Free up space", then Start / Resume Archive.`
      );
      return;
    }

    const row = rows.find(r => {
      const rowUrl = r["URL"];
      return rowUrl && !completedUrls.includes(rowUrl);
    });

    if (!row) {
      setArchiveRunning(false);
      archiveJobRef.current = null;
      alert("Archive complete! All spreadsheet videos have been processed.");
      return;
    }

    const title = row["Title"];
    const videoUrl = row["URL"];

    if (!title || !videoUrl) {
      alert("An archive row is missing Title or URL.");
      setArchiveRunning(false);
      return;
    }

    const info = await window.electronAPI.getVideoInfo(videoUrl);

    if (!info.success) {
      alert(
        `Could not fetch:\n${title}\n\n${info.error}\n\n` +
        `Archive stopped. Resume after resolving the problem.`
      );
      setArchiveRunning(false);
      return;
    }

    if (info.isAudioOnly || !info.formats?.length) {
      alert(`No usable video format found for:\n${title}`);
      setArchiveRunning(false);
      return;
    }

    // Start at the highest real video quality from 720p through 1440p. The formats
    // supplied by main.js are already ordered highest-to-lowest. If that
    // stream fails, the job-finished handler retries this same video at the
    // next lower eligible quality, but never automatically below 720p.
    const formats = info.formats.filter(format =>
      Number(format.height) >= 720 && Number(format.height) <= 1440
    );

    if (formats.length === 0) {
      alert(`No usable video format from 720p through 1440p found for:\n${title}`);
      setArchiveRunning(false);
      return;
    }

    try {
      await queueArchiveAttempt({
        info,
        title,
        videoUrl,
        targetDir,
        formats,
        formatIndex: 0,
      });
    } catch (error) {
      alert(`Could not queue:\n${title}\n\n${error.message}`);
      setArchiveRunning(false);
    }
  };

  const handleStartArchive = async () => {
    if (archiveRows.length === 0) {
      alert("Import the archive spreadsheet first.");
      return;
    }

    const targetDir = await window.electronAPI.chooseDirectory();
    if (!targetDir) return;

    archiveTargetDirRef.current = targetDir;

    const saved = await window.electronAPI.getArchiveProgress();
    const completedUrls = Array.isArray(saved?.completedUrls)
      ? saved.completedUrls
      : [];

    setArchiveProgress(saved);
    setArchiveRunning(true);

    await queueNextArchiveVideo(
      archiveRowsRef.current,
      completedUrls,
      targetDir
    );
  };

  useEffect(() => {
    if (!archiveRunning || !archiveJobRef.current) return;

    const current = archiveJobRef.current;
    const result = jobResults?.[current.jobId];

    if (!result) return;

    archiveJobRef.current = null;

    if (!result.success) {
      if (result.cancelled) {
        setArchiveRunning(false);
        return;
      }

      const nextFormatIndex = current.formatIndex + 1;

      if (nextFormatIndex < current.formats.length) {
        const failedFormat = current.formats[current.formatIndex];
        const nextFormat = current.formats[nextFormatIndex];

        console.warn(
          `Archive download failed at ${failedFormat?.quality || "current quality"}; ` +
          `retrying ${current.title} at ${nextFormat?.quality || "next lower quality"}.`,
          result.error || "Unknown download error"
        );

        queueArchiveAttempt({
          info: current.info,
          title: current.title,
          videoUrl: current.url,
          targetDir: current.targetDir,
          formats: current.formats,
          formatIndex: nextFormatIndex,
        }).catch(error => {
          console.error("Archive fallback queue failed:", error);
          setArchiveRunning(false);
          alert(`Archive stopped:\n${error.message}`);
        });

        return;
      }

      const recordFailureAndContinue = async () => {
        const saved = await window.electronAPI.getArchiveProgress();
        const completedUrls = Array.isArray(saved?.completedUrls)
          ? saved.completedUrls
          : [];
        const failedVideos = Array.isArray(saved?.failedVideos)
          ? saved.failedVideos
          : [];

        const failedFormat = current.formats[current.formatIndex];
        const failure = {
          url: current.url,
          title: current.title,
          lastQualityTried: failedFormat?.quality || `${failedFormat?.height || "Unknown"}p`,
          error: result.error || "Unknown download error",
          failedAt: new Date().toISOString(),
        };

        const updatedFailedVideos = [
          ...failedVideos.filter(item => item?.url !== current.url),
          failure,
        ];

        // Treat the failed URL as processed for this archive run so Resume
        // does not loop back to it. The failure remains listed separately.
        const updatedUrls = completedUrls.includes(current.url)
          ? completedUrls
          : [...completedUrls, current.url];

        const updated = {
          ...saved,
          completedUrls: updatedUrls,
          failedVideos: updatedFailedVideos,
          lastFailed: failure,
        };

        await window.electronAPI.setArchiveProgress(updated);
        setArchiveProgress(updated);

        console.error(
          `Archive skipped after all 720p-or-better qualities failed: ${current.title}`,
          failure
        );

        if (!archiveTargetDirRef.current) {
          setArchiveRunning(false);
          return;
        }

        await queueNextArchiveVideo(
          archiveRowsRef.current,
          updatedUrls,
          archiveTargetDirRef.current
        );
      };

      recordFailureAndContinue().catch(error => {
        console.error("Could not record failed archive video:", error);
        setArchiveRunning(false);
        alert(`Archive stopped while recording a failed video:\n${error.message}`);
      });
      return;
    }

    const finishAndContinue = async () => {
      const saved = await window.electronAPI.getArchiveProgress();
      const completedUrls = Array.isArray(saved?.completedUrls)
        ? saved.completedUrls
        : [];

      const updatedUrls = completedUrls.includes(current.url)
        ? completedUrls
        : [...completedUrls, current.url];

      const updated = {
        ...saved,
        completedUrls: updatedUrls,
        lastCompleted: {
          url: current.url,
          title: current.title,
          completedAt: new Date().toISOString(),
        },
      };

      await window.electronAPI.setArchiveProgress(updated);
      setArchiveProgress(updated);

      if (!archiveTargetDirRef.current) {
        setArchiveRunning(false);
        return;
      }

      await queueNextArchiveVideo(
        archiveRowsRef.current,
        updatedUrls,
        archiveTargetDirRef.current
      );
    };

    finishAndContinue().catch(error => {
      console.error("Archive continuation failed:", error);
      setArchiveRunning(false);
      alert(`Archive stopped:\n${error.message}`);
    });
  }, [jobResults, archiveRunning]);

  // px-[21px] matches the card's inner inset below (20px padding + 1px border),
  // so this row shares a column with Downloads / Settings / Clear.
  return (
    <header className="flex items-center gap-3">
      <div className="relative flex-1">
        <Input
          ref={urlInputRef}
          type="text"
          placeholder="Paste a video URL..."
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          onFocus={() => setUrlFocused(true)}
          onBlur={() => setUrlFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleFetchDetails();
            // Escape hands focus back to the app so the global shortcuts apply
            // again. The URL stays — losing a pasted link to a stray keypress
            // would be worse than the extra keystroke to clear it.
            else if (e.key === "Escape") e.currentTarget.blur();
          }}
          className="h-10 bg-card border-border/50 text-sm placeholder:text-muted-soft pr-10"
        />
        {/* Advertises the focus shortcut, and gets out of the way once used */}
        <Kbd
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-150 ${
            urlFocused || url ? 'opacity-0' : 'opacity-60'
          }`}
        >
          /
        </Kbd>
      </div>
      <Button
        onClick={handleFetchDetails}
        disabled={!url || isLoading}
        className="h-10 px-5 min-w-32.5 font-semibold"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Search className="h-4 w-4" />
            Get Video
          </>
        )}
      </Button>
      <Button
        variant="outline"
        onClick={handleImportSpreadsheet}
        className="h-10 px-4 font-semibold"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Import Spreadsheet
      </Button>
      <Button
        variant="outline"
        onClick={handleStartArchive}
        disabled={archiveRows.length === 0 || archiveRunning}
        className="h-10 px-4 font-semibold"
      >
        {archiveRunning ? "Archive Running..." : "Start / Resume Archive"}
      </Button>
      {/* Downloads — visible whenever anything is queued or downloading */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            onClick={goBackToHistory}
          >
            <ArrowDownToLine className="h-4 w-4" />
            {activeJobs.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                {isDownloading && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                )}
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {activeJobs.length > 0
            ? `Downloads — ${activeJobs.length} active`
            : 'Downloads'}
        </TooltipContent>
      </Tooltip>

      {/* The mark, doing what a brand mark does: linking to the site */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="YT-Forge website"
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => window.electronAPI.openExternalLink(LANDING_URL)}
          >
            <Logo className="w-[17px]! h-[11.2px]!" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          YT-Forge website ↗
        </TooltipContent>
      </Tooltip>
    </header>
  );
};

export default Header;
