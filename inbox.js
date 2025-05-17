let popup = document.getElementById("popup");
        let message

        // load local storage
        window.addEventListener('DOMContentLoaded', () => {
            const messages = JSON.parse(localStorage.getItem('inboxMessages')) || [];
            const messagesDiv = document.getElementById("messages");
            messages.forEach(msg => {
                const msgDiv = document.createElement("div");
                msgDiv.className = msg.sender === "me" ? "message me" : "message";
                msgDiv.textContent = msg.text;
                messagesDiv.appendChild(msgDiv);
            });
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });

        document.getElementById("sendmessage").onclick = function(){
            const input = document.getElementById("themessage");
            const msg = input.value.trim();
            if(msg) {
                // save to localstore
                let messages = JSON.parse(localStorage.getItem('inboxMessages')) || [];
                messages.push({ sender: "me", text: msg });
                localStorage.setItem('inboxMessages', JSON.stringify(messages));

                // dipslay
                const msgDiv = document.createElement("div");
                msgDiv.className = "message me";
                msgDiv.textContent = msg;
                document.getElementById("messages").appendChild(msgDiv);
                input.value = "";
                document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
            }
        };
        // send message when enter
        document.getElementById("themessage").addEventListener("keydown", function(e){
            if(e.key === "Enter") document.getElementById("sendmessage").click();
        });

        function openPopup(){
            popup.classList.add("open-popup");
        }