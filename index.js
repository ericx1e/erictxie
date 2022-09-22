let typingInterval = window.setInterval(typingAnimation, 130);

let titleText = "Eric Xie";
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
            typingCounter += 2;
            // document.getElementById("title").innerHTML = titleText.substring(0, typingCounter - 1) + "_";
        } else {
            document.getElementById("title").innerHTML = titleText.substring(0, typingCounter) + "_";
        }
        typingCounter++;
    } else {
        kek();
        clearInterval(typingInterval);
        window.setInterval(cursorBlinkAnimation, 450);
    }
}

function cursorBlinkAnimation() {
    if (cursorBlink) {
        document.getElementById("title").innerHTML = titleText + "_";
    } else {
        document.getElementById("title").innerHTML = titleText;
    }
    cursorBlink = !cursorBlink;
}

function kek() {
    //get the welcome msg element
    var $all_msg = $('#welcome_msg');
    //get a list of letters from the welcome text
    var $wordList = $('#welcome_msg').text().split("");
    //clear the welcome text msg
    $('#welcome_msg').text("");
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

