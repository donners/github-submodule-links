// This code is pretty hacky and very much tied to GitHub's current HTML.
// Expect it to break when GitHub changes things around, or just at random.

function rewriteSubmoduleHashesToLinks() {
    var containingElement = document.querySelectorAll("td.blob-code");
    var submoduleHashElements = [];
    var submoduleHashes = [];

    for (var i = 0; i < containingElement.length; i++) {
        var processedHTML = containingElement[i].innerHTML;
        processedHTML = processedHTML.replace(/<[^>]*>/g, '');
        var trymatch = processedHTML.match(/Subproject commit ([a-f0-9]{40})/);
        if (!trymatch) continue;
        processedHTML = trymatch[1];
        if (/[a-f0-9]{40}/.test(processedHTML)) {
            submoduleHashElements.push(containingElement[i])
            submoduleHashes.push(processedHTML);
        }
    }

    if (submoduleHashElements.length > 0) {
        fetchSubmodulePaths(function(submodulePaths) {
            for (var i = 0; i < submoduleHashElements.length; i++) {
                rewriteSubmoduleHashToLink(submoduleHashElements[i], submoduleHashes[i], submodulePaths, submoduleHashes);
            }
        });
    }
}

function fetchSubmodulePaths(callback) {
    var guessAtCurrentCommitForGitConfig = document.body.innerHTML.match(/commit\/([a-f0-9]{40})/)[1];

    var currentRepoPath = window.location.pathname.match(/\/[^\/]*\/[^\/]*\//)[0];

    var gitModulesPath = 'https://github.com' + currentRepoPath + 'blob/' + guessAtCurrentCommitForGitConfig + '/.gitmodules'

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        var submoduleRegexes = [/url\s*=[^>]*github.com:([^<\s]*)\.git/g, /url\s*=[^>]*git:\/\/github.com\/([^<\s]*).git/g, /url\s*=[^>]*https?:\/\/github.com\/([^<\s]*).git/g];
        var submodules = [];
        for (var i = 0; i < submoduleRegexes.length; i++) {
            while ((submodule = submoduleRegexes[i].exec(xhr.responseText)) !== null) {
                submodules.push(submodule[1]);
            }
        }

        callback(submodules);
    }
    xhr.open("GET", gitModulesPath);
    xhr.send();
}

function rewriteSubmoduleHashToLink(submoduleHashElement, submoduleHash, submodulePaths, submoduleHashes) {
    for (var i = 0; i < submodulePaths.length; i++) {
        var submoduleCommitPath = 'https://github.com/' + submodulePaths[i] + '/commit/' + submoduleHash;
        rewriteLinkIfValid(submoduleCommitPath, submoduleHashElement, submoduleHash, submoduleHashes);
    }
}

function rewriteLinkIfValid(submoduleCommitPath, submoduleHashElement, submoduleHash, submoduleHashes) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        if (xhr.status === 200) {
            submoduleHashElement.innerHTML = '<a href="' + submoduleCommitPath + '">' +
                    submoduleHashElement.innerHTML +
                '</a>' +  getDiffLinkPlaceholderHTMLAndInsertIfExists(submoduleCommitPath, submoduleHash, submoduleHashes);
                ;
        }
    }
    xhr.open("HEAD", submoduleCommitPath);
    xhr.send();
}

function getDiffLinkPlaceholderHTMLAndInsertIfExists(submoduleCommitPath, submoduleHash, submoduleHashes) {
    var placeholderHTML = "";
    for (var i = 0; i < submoduleHashes.length; i++) {
        if (submoduleHash == submoduleHashes[i]) continue;
        placeholderHTML += '<span id="' + submoduleHash + '…' + submoduleHashes[i] + '"></span>';
        insertDiffLinkIfValid(submoduleCommitPath, submoduleHash, submoduleHashes[i]);
    }

    return placeholderHTML;
}

function insertDiffLinkIfValid(submoduleCommitPath, submoduleHash, nextSubmoduleHash) {
    var diffURL = submoduleCommitPath.replace(/\/commit\//, '/compare/') + '...' + nextSubmoduleHash;
    var shortDiff = submoduleHash.substring(0, 4) + '…' + nextSubmoduleHash.substring(0, 4);

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        if (xhr.status === 200) {
            var placeholder = document.getElementById(submoduleHash + '…' + nextSubmoduleHash);
            placeholder.innerHTML = ' <a href="' + diffURL + '">' + shortDiff + '</a> ';
        }
    }
    xhr.open("HEAD", diffURL);
    xhr.send();
}


// Run on page load
rewriteSubmoduleHashesToLinks();

// Run every second in case the page was partially swapped in as GitHub loves to do
// TODO: find an event that reliably fires on soft page loads (URL change maybe? can't find an event for that)
var lastUrl = window.location.href;
setInterval(function() {
    if (window.location.href != lastUrl) {
        lastUrl = window.location.href;
        rewriteSubmoduleHashesToLinks();
    }
}, 1000)
