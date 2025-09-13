import app from "./api/index.js";
import chalk from "chalk";
import gradient from "gradient-string";
import figlet from "figlet";
import boxen from "boxen";
import asciichart from "asciichart";

const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  figlet("Sipbos Server", (err, data) => {
    if (err) {
      console.log("Something went wrong...");
      console.dir(err);
      return;
    }

    console.log(gradient.pastel.multiline(data));

    const msg = `
${chalk.green("✔ Author   :")} Adyfas
${chalk.green("✔ Server   :")} Running...
${chalk.green("✔ Port     :")} ${PORT}
${chalk.green("✔ Protocol :")} http
${chalk.green("✔ Url      :")} http://localhost:${PORT}
    `;

    console.log(
      boxen(msg, {
        padding: 1,
        margin: 1,
        borderStyle: "double",
        borderColor: "green",
        backgroundColor: "#000000",
      })
    );

    // // === Tambahan Chart ===
    // const datas = [
    //   Math.sin(0),
    //   Math.sin(12),
    //   Math.sin(10),
    //   Math.sin(3),
    //   Math.sin(4),
    //   Math.sin(900),
    //   Math.sin(100),
    // ];
    // console.log(chalk.cyan("\n📊 Server Load Chart:\n"));
    // console.log(
    //   asciichart.plot(datas, { height: 10, colors: [asciichart.blue] })
    // );
  });
});
