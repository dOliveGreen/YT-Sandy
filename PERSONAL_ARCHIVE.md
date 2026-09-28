# YT-Sandy Personal Archive Edition

YT-Sandy extends YT-FORGE with a workflow designed for large, long-running personal YouTube archives while retaining the original downloader functionality.

## Personal Archive Features

- **Spreadsheet-driven bulk archiving**
  Processes a spreadsheet containing video titles, URLs, and dates automatically.

- **Spreadsheet-controlled filenames**
  Uses the supplied spreadsheet date and title for archive filenames rather than replacing them with newly fetched YouTube metadata.

- **Persistent Start / Resume**
  Completed URLs are recorded. The archive can be stopped, YT-FORGE can be closed, or the PC can be restarted, and the archive can later resume without downloading completed videos again.

- **20 GB disk-space safety reserve**
  Checks available destination-drive space before starting the next archive download. If free space falls below 20 GB, the archive pauses rather than continuing to fill the drive. After space is freed, the archive can be resumed from its saved progress.

- **High-quality archive preference**
  Automated archiving targets available video qualities from 720p through 1440p rather than silently accepting a low-resolution result.

- **Enhanced YouTube format retrieval**
  Uses an additional YouTube retrieval path when the normal extraction method exposes an incomplete format list, allowing higher-quality streams to be recovered when available.

- **Automatic quality fallback**
  If a selected high-quality stream fails, another eligible quality can be attempted automatically.

- **Unattended archive operation**
  A problematic video does not have to stop an entire large archive. After eligible attempts are exhausted, the failure is recorded and processing continues.

- **Failure tracking**
  Videos that cannot satisfy the archive requirements are recorded separately with their title, URL, attempted quality, error, and failure time for later review.

- **Conservative low-quality handling**
  If no 720p-or-better stream can be obtained, the video is left for manual review rather than automatically filling the archive with a lower-quality copy.

## Purpose

This edition is intended for personal archival workflows where continuity, recoverability, storage protection, filename consistency, unattended operation, and preservation quality are important.
