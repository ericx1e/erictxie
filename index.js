let typingInterval = window.setInterval(typingAnimation, 130);

let titleText = 'Eric Xie<br><span style="font-size: 0.6em;">student<br>programmer';
let typingCounter = -5;
let cursorBlink = false;

// document.getElementById("title").innerHTML = "_";

function typingAnimation() {
    // console.log(document.getElementById("title").innerHTML.charAt(typingCounter - 2));
    if (typingCounter < 0) { //Delay before the animation really starts
        document.getElementById("title").innerHTML = "_";
        typingCounter++;
        return;
    }

    if (typingCounter <= titleText.length) {
        if (titleText.charAt(typingCounter - 1) == '<') {
            typingCounter = titleText.indexOf(">", typingCounter);
            // document.getElementById("title").innerHTML = titleText.substring(0, typingCounter - 1) + "_";
        } else {
            document.getElementById("title").innerHTML = titleText.substring(0, typingCounter) + "_";
        }
        typingCounter++;
    } else {
        fadeIn();
        clearInterval(typingInterval);
        window.setInterval(cursorBlinkAnimation, 450);
    }
}

function cursorBlinkAnimation() {
    if (cursorBlink) {
        document.getElementById("title").innerHTML = titleText + "_" + "</span>";
    } else {
        document.getElementById("title").innerHTML = titleText + "</span>";
    }
    cursorBlink = !cursorBlink;
}

function fadeIn() {
    //get the welcome msg element
    var $all_msg = $('#fade-in');
    //get a list of letters from the welcome text
    var $wordList = $('#fade-in').text().split("");
    //clear the welcome text msg
    $('#fade-in').text("");
    //loop through the letters in the $wordList array
    $.each($wordList, function (idx, elem) {
        //create a span for the letter and set opacity to 0
        var newEL = $("<span/>").text(elem).css({
            opacity: 0,
            fontSize: 30
        });
        //append it to the welcome message
        newEL.appendTo($all_msg);
        //set the delay on the animation for this element
        newEL.delay(idx * 50);
        //animate the opacity back to full 1
        newEL.animate({
            opacity: 1
        }, 1100);
    });
}

$(function () { //on window ready

});

