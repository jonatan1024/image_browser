//
// SAGE2 application: image_browser
// by: Jonatan Matějka <jonatan1024@gmail.com>
//
// Copyright (c) 2015
//

"use strict";

/* global  */

var image_browser = SAGE2_App.extend({
    //main entry, create all necessery elements
    init: function(data){
        //use div as main container
        this.SAGE2Init("div", data);
        //add custom style
        this.element.className += " ib-element";
        //create custom scrollbar
        this.scrollbar = document.createElement("div");
        this.scrollbar.className = "ib-scrollbar";
        this.element.appendChild(this.scrollbar);
        //initialize scrollbar
        this.refreshScrollbar();
        //register for resize events
        this.resizeEvents = "continuous";
        //figure out how big the thumbnails really are
        this.calcTNDims();
        //create the image layer
        this.createLayer("#000");
        this.img = document.createElement("img");
        this.img.className = "ib-img";
        this.layer.appendChild(this.img);
        //prepare file list and register for changes
        this.files = [];
        this.registerFileListHandler(this.updateFiles);
        //load current state of the application
        this.updateAppFromState();
    },
    //figure out how big the thumbnails really are
    calcTNDims(){
        //these constants needs to be in sync with the css file!
        var imgWidth = 512;
        var imgHeight = imgWidth;
        var tnPadding = 16;
        var tnMargin = 16;
        var labelHeight = 64;
        
        this.tnWidth = imgWidth + 2*tnPadding + 2*tnMargin;
        this.tnHeight = imgHeight + labelHeight + 2*tnPadding + 2*tnMargin;
    },
    //called on external sync
    load: function(date) {
        this.updateAppFromState();
        this.refresh(date);
    },
    //update application from given state
    updateAppFromState: function(){
        //copy out variables (state will be destroyed by subsequent calls in this function)
        var fileName = this.state.file;
        var top = this.state.top;
        var selected = this.state.selected;
        //set current directory from state
        this.changeDirectory(this.state.cwd);
        //open file form state, if there is any
        if(fileName){
            this.openFile(fileName);
        }
        //select corresponding thumbnail
        this.selectThumbnail(selected);
        //set window position
        this.setScroll(top);
    },
    //set window scroll position (and never give up!)
    setScroll: function(top){
        //try to set the position
        this.element.scrollTop = top;
        if(this.element.scrollTop == top){
            //if we succeded, save the state and exit
            this.state.top = top;
            this.save();
        }else{
            //if we failed, retry later (we wait until enough thumbnails is loaded to allow the scroll)
            var _this = this;
            //cancell all previous attempts
            clearTimeout(this.setScrollTimeout);
            this.setScrollTimeout = setTimeout(function(){ _this.setScroll(top); }, 200);
        }
    },
    //save current application state
    save: function(){
        //copied form quickNote application, should reliably save the state 
        this.SAGE2UpdateAppOptionsFromState();
        this.SAGE2Sync(true);
        this.resize();
        //immediately refresh scrollbar positon
        this.refreshScrollbar();
    },
    //update scrollbar position and size
    refreshScrollbar: function(){
        //compare the whole height and the visible height
        var sbSize = this.element.scrollHeight/this.element.clientHeight;
        if(sbSize < 1 + 0.01){
            //if everything is on screen, hide the scrollbar
            this.scrollbar.style.visibility = "hidden";
        }else{
            //scale and the scrollbar accodringly 
            this.scrollbar.style.visibility = "visible";
            var sbHeight = this.element.clientHeight / sbSize;
            this.scrollbar.style.height = sbHeight+"px";
            var sbTop = this.element.scrollTop / sbSize;
            this.scrollbar.style.top = sbTop+"px";
        }
        //do this forever
        var _this = this;
        //to avoid multiple loops running, kill all other scrollbar-refreshers
        clearTimeout(this.scrollbarTimeout);
        //update again after 200ms
        this.scrollbarTimeout = setTimeout(function(){ _this.refreshScrollbar(); }, 200);
    },
    //user pressed the scrollbar, remember the starting height
    scrollbarPress: function(position){
        //did he really hit the scrollbar?
        if( position.x >= this.scrollbar.offsetLeft &&
            position.x <= this.scrollbar.offsetLeft + this.scrollbar.offsetWidth &&
            position.y >= this.scrollbar.offsetTop &&
            position.y <= this.scrollbar.offsetTop + this.scrollbar.offsetHeight){
                //remember the height
                this.sbPos = position.y;
        }
    },
    //user is dragging the scrollbar
    scrollbarMove: function(position){
        //did he ever pressed it?
        if(this.sbPos !== undefined){
            //find out the difference
            var delta = position.y - this.sbPos;
            var sbSize = this.element.scrollHeight/this.element.clientHeight;
            //update scroll position accordingly
            this.element.scrollTop += delta * sbSize;
            //update the state, but DON'T SAVE IT yet, we wait for the release
            this.state.top = this.element.scrollTop;
            this.sbPos = position.y;
            //immediately refresh scrollbar positon
            this.refreshScrollbar();
        }
    },
    //user released the scrollbar
    scrollbarRelease: function(position){
        //did he ever pressed it?
        if(this.sbPos !== undefined){
            //drag it to the end
            this.scrollbarMove(position);
            //save current scroll state
            this.save();
            //reset the scrollbar-pressing mechanism
            delete this.sbPos;
        }
    },
    //all drawing is time-independent, so... useless function
    draw: function(date) {
    },
    //somebody resized the app window!
    resize: function(date) {
        //update size of the layer
        if(!this.isLayerHidden()){
            this.hideLayer(); 
            this.showLayer();
        }
        //immediately refresh scrollbar positon
        this.refreshScrollbar();
        //notify
        this.refresh(date);
    },
    //we don't have to handle movement
    move: function(date) {
        //notify
        this.refresh(date);
    },
    //open required file in the overlay layer
    openFile: function(fileName){
        //if this was passed via context menu, normalize object type
        if(fileName.fileName !== undefined){
            fileName = fileName.fileName;
        }
        //get file object
        var file = this.directory[fileName];
        if(file !== undefined){
            //display image, select assigned thumbnail and save state
            this.showLayer();
            this.img.src = file.sage2URL;
            this.state.file = fileName;
            this.selectOpenFile();
            this.save();
        }
    },
    //open next/previous file
    nextFile: function(offset){
        //default is next
        if(offset === undefined)
            offset = 1;
        var fileNames = [];
        var index = 0;
        //get all images inside the folder
        for(var fileName in this.directory){
            if(this.directory[fileName] === "<DIR>")
                continue;
            if(fileName == this.state.file)
                index = fileNames.length;
            fileNames.push(fileName);
        }
        //find next file
        index += offset;
        index += fileNames.length;
        index %= fileNames.length;
        //open that file
        this.openFile(fileNames[index]);
    },
    //close opened file
    closeFile: function(){
        //hide layer and save state
        this.state.file = "";
        this.hideLayer();
        this.save();
    },
    //registered callback for receiving filesystem updates
    updateFiles: function(data){
        //store data
        this.files = data.images;
        //refresh the app
        this.updateAppFromState();
    },
    //get contents of current directory
    listDirectory: function(){
        var dirPath = this.state.cwd.split("/");
        var dirFiles = {};
        //is this root?
        if(this.state.cwd === "/"){
            //root-level hack
            dirPath.pop();
        }else{
            //add "previous directory"
            dirFiles[".."] = "<DIR>";
        }
        //goto is awesome!
        fileLoop:
        for(var i in this.files){
            var file = this.files[i];
            var filePath = file.sage2URL.split("/");
            if(dirPath.length > filePath.length)
                continue fileLoop;
            //all directories along the path must match
            for(var j = 0; j < dirPath.length; j++){
                if(dirPath[j] != filePath[j]){
                    //skip this file
                    continue fileLoop;
                }
            }
            //this is either filename or directory name
            var localName = filePath[dirPath.length];
            //what is it?
            if(filePath.length > dirPath.length+1)
                dirFiles[localName] = "<DIR>";
            else
                dirFiles[localName] = file;
        }
        this.directory = dirFiles;
        return dirFiles;
    },
    //change current working directory
    changeDirectory: function(newDir){
        //if this was passed via context menu, normalize object type
        if(newDir.fileName !== undefined){
            newDir = newDir.fileName;
        }
        //is this absolute or relative path?
        if(newDir[0] === "/"){
            //absolute - just set
            this.state.cwd = newDir;
        }else{
            //relative - split and join!
            var path = this.state.cwd.split("/");
            
            if(newDir === ".."){
                //go to parent directory
                if(path.length == 2){
                    //root-level hack
                    path[1] = "";
                }else{
                    path.pop();
                }
            }else{
                //go to specified directory
                if(this.state.cwd === "/"){
                    //root-level hack
                    path.pop();
                }
                path.push(newDir);
            }
            //glue the new path together!
            this.state.cwd = path.join("/");
        }
        //pretty much refresh the whole app state
        //get new directory contents
        this.listDirectory();
        //force context menu update
        this.getFullContextMenuAndUpdate();
        //reset scroll position
        this.state.top = 0;
        //display all thumbnails
        this.showThumbnails();
        //reset thumbnail selection
        this.selectThumbnail(0);
        //close opened file (if any)
        this.closeFile();
        //save this state
        this.save();
    },
    //create UI context menu
    getContextEntries: function(){
        var entries = [];
        //wait for proper directory list
        if(this.directory === undefined){
            return [];
        }
        for(var fileName in this.directory){
            var file = this.directory[fileName];
            var isDir = (file === "<DIR>");
            //add "folder" icon for subdirectories and "open folder" icon for parent directory
            var icon = "";
            if(isDir)
                icon = fileName === ".." ? "&#128194; " : "&#128193; ";
            var entry = {
                //filenames are essentially urls so we need to decode them
                description: icon+decodeURIComponent(fileName),
                //wrap the filename in object
                parameters: {fileName: fileName},
                //clicking on this will either open file or change directory
                callback: isDir ? "changeDirectory" : "openFile"
            };
            entries.push(entry);
        }
        //add horizontal line before the default options
        entries.push({
            description: "separator"
        });
        return entries;
    },
    //display thumbnails for current directory contents
    showThumbnails: function(){
        //delete old thumbnails
        for(var i in this.thumbnails){
            this.element.removeChild(this.thumbnails[i]);
        }
        this.thumbnails = [];
        for(var fileName in this.directory){
            var file = this.directory[fileName];
            var isDir = (file === "<DIR>");
            //directories gets icons, images gets thumbs 
            if(isDir){
                var icon = document.createElement("div");
                //"folder" icon for subdirectories and "open folder" icon for parent directory
                icon.innerHTML = fileName === ".." ? "&#128194;" : "&#128193;";
                //style it so it fits nice
                icon.className = "ib-tn-icon";
            }else{
                //load thumb generated by sage2 backend
                var tnFile = file.exif.SAGE2thumbnail + "_512.jpg";
                var icon = document.createElement("img");
                //style it
                icon.className = "ib-tn-img";
                icon.src = tnFile;
            }
            
            //add filename label under the thumb
            var label = document.createElement("div");
            //filenames are essentially urls so we need to decode them
            label.innerHTML = decodeURIComponent(fileName);
            //style it
            label.className = "ib-tn-label"
            
            //create container for the thumb/icon and label
            var container = document.createElement("div");
            //style it, round those corners!
            container.className = "ib-thumbnail";
            container.appendChild(icon);
            container.appendChild(label);
            //add this container into the main element
            this.element.appendChild(container);
            this.thumbnails.push(container);
        }
    },
    //user selected a thumbnail
    selectMouseThumbnail: function(position){
        //but which one is it?
        for(var i = 0; i < this.thumbnails.length; i++){
            var container = this.thumbnails[i];
            if( position.x >= container.offsetLeft &&
                position.x <= container.offsetLeft + container.offsetWidth &&
                position.y + this.element.scrollTop >= container.offsetTop &&
                position.y + this.element.scrollTop <= container.offsetTop + container.offsetHeight){
                    //this one! select it
                    this.selectThumbnail(i);
                    break;
            }
        }
    },
    //select a thumbnail of given index
    selectThumbnail: function(index){
        //previously selected thumbnail        
        var oldThumbnail = this.thumbnails[this.state.selected];
        //reset style
        oldThumbnail.className = "ib-thumbnail";
        
        //newly selected thumb
        this.state.selected = index;
        var thumbnail = this.thumbnails[this.state.selected]
        //set selected style, show the border!
        thumbnail.className += " ib-thumbnail-selected";
        
        //does this thumb fit into current scrolled window
        var tnTop = thumbnail.offsetTop;
        var tnBottom = thumbnail.offsetTop + thumbnail.offsetHeight;
        var eleTop = this.element.scrollTop;
        var eleBottom = this.element.scrollTop + this.element.clientHeight;
        //some of it is hidden underneath the top
        if(tnTop < eleTop){
            this.state.top -= eleTop - tnTop;
        }
        //some of it is hidden under the bottom part
        else if(tnBottom > eleBottom){
            this.state.top += tnBottom - eleBottom;
        }
        //fix the scroll position
        this.element.scrollTop = this.state.top;
        this.state.top = this.element.scrollTop;
        //save thumbnail selection and scroll position
        this.save();
    },
    //open selected image or directory
    openSelectedThumbnail: function(){
        var i = 0;
        for(var fileName in this.directory){
            //ok, which one is selected?
            if(i == this.state.selected){
                //this one!    
                if(this.directory[fileName] === "<DIR>"){
                    //open the dir
                    this.changeDirectory(fileName);
                }else{
                    //open the img
                    this.openFile(fileName);
                }
                return;
            }
            i++;
        }
    },
    //user opened some file, we want to select related thumbnail
    selectOpenFile: function(){
        if(this.state.file !== undefined){
            var i = 0;
            for(var fileName in this.directory){
                //which one is open?
                if(fileName == this.state.file){
                    //this one! select it!
                    this.selectThumbnail(i);
                    return;
                }
                i++;
            }
        }
    },
    //main event handler
    event: function(eventType, position, user_id, data, date) {
        //copy current scroll position and selected thumbnail
        var top = this.state.top;
        var selected = this.state.selected;
        //what is currently shown?
        if(this.isLayerHidden()){
            //directory listing is shown
            if(eventType === "specialKey" && data.state === "down"){
                //user hit some key
                //how much thumbnails are there in a row?
                var tnPerLine = Math.floor(this.element.clientWidth / this.tnWidth);
                //how much thumbs are there on one page
                var tnPerPage = Math.floor(this.element.clientHeight / this.tnHeight) * tnPerLine;
                if (data.code === 39) { // right
                    //select next
                    selected++;
                }
                else if (data.code === 37) { // left
                    //select previous
                    selected--;
                }
                else if (data.code === 38) { // up
                    //select thumb on previous line
                    selected -= tnPerLine;
                }
                else if (data.code === 40) { // down
                    //select thumb on next line
                    selected += tnPerLine;
                }
                else if (data.code === 33) { // page up
                    //select thumb on previous page
                    selected -= tnPerPage;
                }
                else if (data.code === 34) { // page down
                    //select thumb on next page
                    selected += tnPerPage;
                }
                else if (data.code === 36) { // home
                    //select first thumb
                    selected = 0;
                }
                else if (data.code === 35) { // end
                    //select last thumb
                    selected = this.thumbnails.length-1;
                }
                else if (data.code === 13 || data.code == 32) { // enter || space
                    //open currently selected thumb
                    this.openSelectedThumbnail();
                    return;
                }
            }
            else if(eventType === "pointerScroll"){
                //user is using mouse scroll
                //scroll the page up/down
                top += data.wheelDelta;
            }
            else if(eventType === "pointerPress" && data.button === "left"){
                //user is pressing LMB
                //handle scrollbar events
                this.scrollbarPress(position);
                return;
            }else if(eventType === "pointerMove"){
                //user is moving the mouse
                //handle scrollbar events
                this.scrollbarMove(position);
                return;
            }
            else if(eventType === "pointerRelease"){
                if(data.button === "left"){
                    //user clicked with LMB
                    //handle scrollbar events
                    this.scrollbarRelease(position);
                    //did he clicked on a thumb?
                    this.selectMouseThumbnail(position);
                    return;
                }
            }
            else if(eventType === "pointerDblClick"){
                //user is doubleclicking
                //did he clicked on a thumb?
                this.selectMouseThumbnail(position);
                //open last selected thumb
                this.openSelectedThumbnail();
                return;
            }
        }else{
            //image is shown
            if(eventType === "specialKey" && data.state === "down"){
                //user his some key
                if (data.code === 39) { // right
                    //open next image
                    this.nextFile();
                    return;
                }
                else if (data.code === 37) { // left
                    //open previous image
                    this.nextFile(-1);
                    return;
                }
                else if (data.code === 13 || data.code == 32) { // enter || space
                    //close current image
                    this.closeFile();
                    return;
                }
            }
            else if(eventType === "pointerRelease"){
                if(data.button === "left"){
                    //user LMB clicked somewhere
                    //if it was on right side of the image, go to the next image, otherwise go the previous
                    this.nextFile(Math.sign(position.x - this.element.clientWidth/2));
                    return;
                }else if(data.button === "right"){
                    //user RMB clicked somewhere
                    //close current image
                    this.closeFile();
                    return;
                }
            }
            else if(eventType === "pointerScroll"){
                //user is scrolling with mouse
                //go to next/previous image
                this.nextFile(Math.sign(data.wheelDelta));
                return;
            }
        }
        //if there was any change in thumb selection, handle it 
        if(selected != this.state.selected){
            //clamp selection to bounds
            selected = Math.min(selected, this.thumbnails.length-1);
            selected = Math.max(selected, 0);
            //apply
            this.selectThumbnail(selected);
            return;
        }
        //if there was any change in scroll position, handle it
        if(top != this.state.top){
            //apply and save
            this.element.scrollTop = top;
            this.state.top = this.element.scrollTop;
            this.save();
        }
    }
});
