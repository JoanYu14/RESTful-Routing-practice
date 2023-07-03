// RESTful Routing
// 所有route寄回給客戶端的response的內容都是一個完整的頁面，不只是一段文字或一個JSON檔

const express = require("express");
const mongoose = require("mongoose");
const app = express();
// 使用method-overrite這個package能讓我們在客戶端也能寄送除了GET和POST的其他Request
const methodOverrite = require("method-override");

// 在mongooseModel資料夾的student.js這個檔案內已經設定好Student這個model，並設定module.exports = Student，所以require("./mongooseModel/student") return就是Student這個modle
const Student = require("./mongooseModel/student");

// 這裡設定了我們用的view engine是ejs，代表我們要渲染的東西都是ejs文件，這樣我們後面用res.render渲染ejs文件時都不用打附檔名了
app.set("view engine", "ejs");

// express.json()會去檢查requests的header有沒有Content-Type: application/json。如果有，就把text-based JSON換成JavaScript能夠存取的JSON物件，然後放入req.body。
app.use(express.json());
// express.urlencoded()會去檢查requests的header有沒有Content-Type: application/x-www-form-urlencoded （也就是去檢查是不是帶有資料的POST、PUT、PATCH）
// 如果有，也把text-based JSON換成JavaScript能夠存取的JSON物件然後放入req.body。
app.use(express.urlencoded({ extended: true }));

// 設定每一筆request都會先以 methodOverride("_method")這個middleware進行前置處理
// 像是edit_student.ejs內的form的action屬性中就有method-overrite的語法，所以這個中介軟體會把原本的POST request變成PUT request
app.use(methodOverrite("_method"));

// 連接到本機的MongoDB的exampleDB這個database
mongoose
  .connect("mongodb://127.0.0.1:27017/exampleDB")
  .then(() => {
    console.log(
      "已成功連結到位於本機port 27017的mongoDB，並且連結到mongoDB中exampleDB這個database了"
    );
  })
  .catch((e) => {
    console.log(e);
  });

// ==========================================================================================================================================================================================================
// 1.尋找所有學生(學生首頁)
// 如果對http://localhost:3000/students寄送一個get Request就會被這個route接收
app.get("/students", async (req, res) => {
  try {
    // await Student.find().exec()會return一個collection中所有的document(物件)的一個陣列，把此陣列存入studentArr變數中
    let studentsArr = await Student.find().exec();

    // 渲染的對象是index.ejs(ejs文件都要放在views資料夾內)，因為前面有設定view engine用的都是EJS，所以可以不打副檔名
    // 設定一個物件，物件的studentsArr屬性為叫做studentsArr的local variable(try中)的值，就可以在students.ejs中使用studentsArr了
    return res.render("students", { studentsArr }); // studentsArr:studentsArr的簡化寫法
  } catch (e) {
    // 如果執行這個程式碼代表客戶端寄出的response確實有被這個route接收到，但是在執行try內部的動作時有發生錯誤，所以是server這裡自己的錯誤，因此寄送的response的狀態要改成500(沒改的話就是send()預設的200OK)
    // 因為method chaining所以，res.status()其實會return response object，所以可以這樣寫
    return res.status(500).send("尋找資料時伺服器發生錯誤"); // 加上return是為了讓catch的程式碼執行到這就結束了
  }
});

// ==========================================================================================================================================================================================================
// 2.新增一個學生

// 2-1給客戶端新增學生的頁面(GET)
// 要寫在尋找指定學生的route前，不然會被那個route接走，因為app.get("/students/:_id", callbackFn)，就是只要students/後面不管寫甚麼，那個route都會接收
// 如果有人對localhost:3000/students/new-student送一個GET request，就會被這個route接收
app.get("/students/new", async (req, res) => {
  try {
    // 回傳new_student_form渲染後的網頁給客戶端
    res.render("new_student_form");
  } catch (e) {
    return res.status(400).render("error", { e });
  }
});

// 2-2新增學生資料到mongoDB中，並回傳包含新增好的學生的資料的頁面(POST)
// POST學生資料(新增學生資料到資料庫中)
// 對http://localhost:3000/students寄送一個POST Request就會被這個route接收
// 因為有使用express.urlencoded()這個middleware，所以post request所傳遞的資料就會從JSON解析成JS能存取的資料，並被存進req.body這個物件中
app.post("/students", async (req, res) => {
  try {
    let { name, age, major, merit, other } = req.body; // 利用解構賦值語法從req.body這個物件中取得這些屬性的值，並存入這些變數中
    let newStudent = new Student({
      name, // name:name的簡化寫法
      age,
      major,
      schlarship: {
        merit, // merit:merit的簡化寫法
        other,
      },
    });

    // 因為await關鍵字，所以newStudent.save()回傳的就不是一個promise物件，而是newStudent這個物件本身(.save()的執行結果)
    // 並且因為await關鍵字，所以在app.post的異步的callbackFn中，這個callbackFn就會停在這裡，直到newStudent.save()執行完畢(fulfilled就繼續執行try的下方程式碼，rejected就執行catch函式)
    let savedStudent = await newStudent.save();

    // 回傳一個內容為一個物件的200OK的Response給客戶端
    return res.render("new_student_data", { savedStudent });
  } catch (e) {
    return res.status(400).render("student_save_fail", { e });
  }
});

// ==========================================================================================================================================================================================================
// 3.獲得指定id學生的資料
// 任何寫在localhost:3000/students/之後的字串都會被當成req.params._id屬性的值(/students/:_id/XXX的不會被這個route接收)
// 如果是在學生首頁點擊學生連結的話基本上是不會有任何問題，但如果客戶是在瀏覽器輸入URL來寄送request到這個route的話就有可能有找不到該id的學生或id根本不符合_id格式的狀況
app.get("/students/:_id", async (req, res) => {
  try {
    let { _id } = req.params; // 利用物件的解構賦值語法把req.parms物件中名為_id屬性的值存到_id變數中

    // Student.findOne()會去尋找students這個collection中第一筆符合_id屬性的值為req.params._id屬性的值的document
    // _id屬性為在collection中儲存一個document時自動給的屬性與值，相當於這個document的primary key
    // 因為filter是看_id是屬性，所以只要沒有符合_id的形式(12 個字節的字符串或 24 個十六進製字符的字符串或整數)就會直接出錯(rejected)而不是得到null結果
    // 因為await關鍵字，所以Student.findOne().exec()這個異步函式所return的不是一個pending狀態promise物件，而是這個異步函式的執行結果(變成fulfilled狀態後promise物件的值)
    let document = await Student.findOne({ _id }).exec(); // { _id }為{_id : _id}的簡化寫法

    // 如果輸入的id是符合_id的格式(12 個字節的字符串或 24 個十六進製字符的字符串或整數)的話，如果找不到_id屬性的值符合的document的話，findOne()就會回傳null
    if (document != null) {
      // 會去渲染student_page.ejs後並將渲染完成的頁面(html)作為response的內容寄送到客戶端
      return res.render("student_page", { document }); // 傳送一個物件，該物件的document屬性的值就是try中的document這個local variable的值，所以在student_page.ejs中就可以使用document
    } else {
      // 如果輸入的id是符合_id格式，但沒有_id屬性符合的document的話就把_id這個local Variable傳送到student_notfound.ejs裡面
      // 渲染完成後後當作response的內容並寄回給客戶端(status code為400)
      return res.status(400).render("student_notfound", { _id });
    }
  } catch (e) {
    // 如果輸入的id不符合格式的話就會變成rejected，執行catch函式，並且參數e帶入的是一個包含錯誤訊息的物件
    // 或者是別的錯誤也會到這裡

    // 將e傳入error.ejs裡面。將error.ejs渲染完再寄送到客戶端，
    return res.status(400).render("error", { e });
  }
});

// ==========================================================================================================================================================================================================
// 4.修改特定學生的資料

// 4-1給客戶端一個包含可以用來修改學生資料的form的網頁
app.get("/students/:_id/edit", async (req, res) => {
  try {
    let { _id } = req.params;
    let student = await Student.findOne({ _id }).exec();

    // 如果輸入的id是符合_id的格式(12 個字節的字符串或 24 個十六進製字符的字符串或整數)的話，如果找不到_id屬性的值符合的document的話，findOne()就會回傳null
    if (student != null) {
      return res.render("student_update", { student });
    } else {
      return res.status(400).render("student_notfound", { _id });
    }
  } catch (e) {
    // 如果輸入的id不符合格式的話就會變成rejected，執行catch函式，並且參數e帶入的是一個包含錯誤訊息的物件
    // 或者是別的錯誤也會到這裡
    return res.status(400).render("error", { e });
  }
});

// 4-2修改MongoDB中的指定學生的資料，並回傳包含修改後的學生資料表格的頁面
// PUT修改特定學生的資料(完全覆寫)
// 對http://localhost:3000/students/XXXX寄送一個PUT Request就會被這個route接收
// 任何寫在localhost:3000/students/之後的字串都會被當成req.params._id屬性的值
app.put("/students/:_id", async (req, res) => {
  try {
    // 因為原本的POST Request的header中有Content-Type: application/x-www-form-urlencoded
    // 即使經過method-overrite的middleware處理後變成PUT Request依然是如此
    // 所以content裡的JSON資料也會透過express.urlencoded()這個中介軟體處理為JS可存取的資料並放入req物件的body物件中

    let { name, age, major, merit, other } = req.body;
    let { _id } = req.params; // 利用物件的解構賦值把req.parms._id的值存入_id變數中

    // newData會存入Student.findOneAndUpdate().exec()的執行結果，就是修改後的document(因為有設定new:true)
    let newData = await Student.findOneAndUpdate(
      { _id },
      { name, age, major, schlarship: { merit, other } },
      {
        // options參數
        new: true, // 設定new為true就是findOneAndUpdate()執行的結果會return更新後的document
        runValidators: true, // 會對update參數給的物件檢查是否符合schema中有設定的validators的規定
        // overwrite: true會使findOneAndUpdate會對找到的document的內容做完全的覆寫，因為HTTP PUT Request在通訊的定義上就是要求客戶端提供所有數據(要不要修改的都要給)
        overwrite: true,
      }
    ).exec();

    return res.render("student_update_success", { newData });
  } catch (e) {
    return res.status(400).render("error", { e });
  }
});

// ==========================================================================================================================================================================================================
// 5.刪除指定學生的資料
// 從瀏覽器的method為POST的form提交後寄出的POST Request經過method-overrite的中介軟體處理後變成DELETE Request後就會被這個route接收
app.delete("/students/:_id", async (req, res) => {
  try {
    let { _id } = req.params;
    let deleteResult = await Student.deleteOne({ _id });

    return res.render("student_delete_success");
  } catch (e) {
    return res.status(400).render("error", { e });
  }
});

app.listen(3000, () => {
  console.log("伺服器正在聆聽port 3000...");
});
