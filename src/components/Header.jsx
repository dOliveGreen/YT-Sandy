import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Loader2, Search, ArrowDownToLine, FileSpreadsheet } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { LANDING_URL } from '@/lib/links';

const Header = () => {
  const { url, urlInputRef, handleUrlChange, handleFetchDetails, isLoading, activeJobs, isDownloading, goBackToHistory } = useAppContext();
  const [urlFocused, setUrlFocused] = useState(false);
  const [archiveRows, setArchiveRows] = useState([]);

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
    console.log("Archive spreadsheet:", result);
  };
  const handleTestArchiveDownload = async () => {
    if (archiveRows.length === 0) {
      alert("Import the archive spreadsheet first.");
      return;
    }

    const row = archiveRows[0];
    const title = row["Title"];
    const url = row["URL"];

    if (!title || !url) {
      alert("The first spreadsheet row is missing Title or URL.");
      return;
    }

    const info = await window.electronAPI.getVideoInfo(url);

    if (!info.success) {
      alert(`Could not fetch video information:\n${info.error}`);
      return;
    }

    if (info.isAudioOnly || !info.formats?.length) {
      alert("No usable video format was found.");
      return;
    }

    const best = info.formats[0];

    const targetDir = await window.electronAPI.chooseDirectory();
    if (!targetDir) return;

    const res = await window.electronAPI.queuePlaylist({
      title: "Archive Test",
      uploader: info.uploader || "",
      url: "",
      targetDir,
      allowDuplicates: true,
      numberItems: false,
      formatLabel: `Best (${best.quality})`,
      thumbnailUrl: info.thumbnailUrl || "",
      items: [{
        id: info.videoId,
        playlistIndex: 1,
        url: info.webpageUrl || url,
        title,
        thumbnail: info.thumbnailUrl || "",
        duration: info.duration || 0,
        type: "mp4",
        quality: String(best.itag),
        qualityLabel: best.quality || "Best",
        convertToH264: false,
        sizeBytes: best.size || 0,
      }],
    });

    if (!res.success) {
      alert(`Could not start test download:\n${res.error}`);
    }
  };

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
        onClick={handleTestArchiveDownload}
        disabled={archiveRows.length === 0}
        className="h-10 px-4 font-semibold"
      >
        Test First Video
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
